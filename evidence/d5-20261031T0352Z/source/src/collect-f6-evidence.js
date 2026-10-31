require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const OpenAI = require('openai');
const { createAgentRunner } = require('./agent-runner');
const { directObservation } = require('./collect-eval-evidence');
const { verifyPlan } = require('./f6-plan');
const { hash, readJson } = require('./eval-evidence');
const { root, relative, writeJson } = require('./evidence-package');

async function invokeF6(request) {
  const client = new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: 'https://api.fireworks.ai/inference/v1',
    maxRetries: 0, timeout: 120000
  });
  const response = await client.chat.completions.create({
    model: request.model, temperature: request.temperature,
    messages: [{ role: 'user', content: request.prompt }]
  });
  return {
    content: response.choices?.[0]?.message?.content || '',
    promptTokens: response.usage?.prompt_tokens ?? null,
    completionTokens: response.usage?.completion_tokens ?? null,
    totalTokens: response.usage?.total_tokens ?? null
  };
}

async function collectVersion({ directory, version, invokeModel = invokeF6, progress = console.log }) {
  directory = path.resolve(directory);
  const { plan, cases } = verifyPlan(directory, { checkWorkingSource: true });
  const index = plan.versions.findIndex(row => row.version === version);
  if (index < 0) throw new Error('Unknown version.');
  const stage = path.join(directory, version);
  if (fs.existsSync(stage)) throw new Error('Version already attempted; use a new planned package, never overwrite or retry.');
  if (index > 0 && !fs.existsSync(path.join(directory, plan.versions[index - 1].version, 'attempts.json'))) {
    throw new Error('Collect each complete predecessor version first.');
  }
  fs.mkdirSync(stage);
  fs.mkdirSync(path.join(stage, 'receipts'));
  const promptFiles = Object.fromEntries(Object.entries(plan.versions[index].prompts)
    .map(([agent, prompt]) => [agent, prompt.file]));
  const observations = [];
  const attempts = [];
  let calls = 0;
  const runner = createAgentRunner({
    promptFiles,
    invokeModel: async request => {
      if (calls >= cases.length) throw new Error('Version invocation budget exhausted.');
      const sequence = ++calls;
      const receipt = {
        sequence, startedAt: new Date().toISOString(), model: request.model,
        temperature: request.temperature, promptHash: hash(request.prompt),
        providerRetries: 0, status: 'REQUEST_STARTED'
      };
      writeJson(path.join(stage, 'receipts', `${sequence}-started.json`), receipt);
      try {
        const response = await invokeModel(request);
        Object.assign(receipt, {
          status: 'RESPONSE_RECEIVED', rawHash: hash(response.content),
          promptTokens: response.promptTokens ?? null,
          completionTokens: response.completionTokens ?? null, totalTokens: response.totalTokens ?? null
        });
        return response;
      } catch {
        receipt.status = 'MODEL_FAILURE';
        throw new Error('Model request failed; see retained receipt. No retry performed.');
      } finally {
        receipt.finishedAt = new Date().toISOString();
        writeJson(path.join(stage, 'receipts', `${sequence}-finished.json`), receipt);
      }
    }
  });
  const runsDir = relative(path.join(stage, 'runs'));
  const auditFile = relative(path.join(stage, 'audit.jsonl'));
  for (const testCase of cases) {
    const correlationId = `F6-${version}-${testCase.id}-${randomUUID()}`;
    const started = {
      version, caseId: testCase.id, agent: testCase.agent, correlationId,
      inputHash: testCase.inputHash, startedAt: new Date().toISOString()
    };
    writeJson(path.join(stage, `${testCase.id}-started.json`), started);
    let outcome;
    try {
      await runner(testCase.agent, testCase.input, correlationId, {
        runtimeMode: 'real', cycle: 1, runsDir, auditFile
      });
      outcome = { status: 'SUCCESS' };
    } catch (error) {
      outcome = { status: error.code || 'COLLECTION_FAILURE', reason: error.message,
        details: error.details || null };
    }
    const observation = directObservation(testCase, correlationId, runsDir, outcome);
    if (observation) observations.push(observation);
    const attempt = {
      ...started, finishedAt: new Date().toISOString(), ...outcome,
      hasRawResponse: Boolean(observation), runsDirectory: `${runsDir}/${correlationId}/cycle-1`
    };
    attempts.push(attempt);
    writeJson(path.join(stage, `${testCase.id}-attempt.json`), attempt);
    progress(`${version} ${testCase.id}: ${outcome.status}`);
  }
  writeJson(path.join(stage, 'direct-responses.json'), {
    version, mode: 'real', collectedAt: new Date().toISOString(), observations
  });
  writeJson(path.join(stage, 'attempts.json'), { version, modelInvocations: calls, attempts });
  verifyPlan(directory, { checkWorkingSource: true });
  return { version, modelInvocations: calls, attempts: attempts.length,
    accepted: attempts.filter(row => row.status === 'SUCCESS').length };
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 3 || argv[2] !== '--allow-live') {
    throw new Error('Usage: node src/collect-f6-evidence.js DIRECTORY v0|v1|v2 --allow-live');
  }
  if (!process.env.AI_API_KEY) throw new Error('Configured Fireworks key required.');
  const directory = path.resolve(argv[0]);
  readJson(path.join(directory, 'collection-plan.json'));
  return collectVersion({ directory, version: argv[1] });
}

if (require.main === module) main().then(value => console.log(JSON.stringify(value, null, 2))).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

module.exports = { collectVersion, main };
