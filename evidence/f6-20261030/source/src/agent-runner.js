/*
It becomes the single place responsible for:
Launching agents
Capturing model usage
Logging audit records
Returning structured results
*/

const config = require('./config');

const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const registry = require('./agent-registry');
const mockResponses = require('./mock-agent-responses');
const { writeAuditEntry } = require('./audit-logger');
const { validateSchema } = require('./schema-validator');
const { writeArtifact } = require('./artifact-writer');
const { estimateCost } = require('./cost-estimator');

const { invokeLlm } = require('./models/fireworks-client');
const { loadPrompt } = require('./prompt-loader');
const { buildPrompt } = require('./prompt-builder');
const {
  contractError,
  requireContract,
  validateReview,
  validateInterpretationTransition
} = require('./governance-policy');
const { reportTemplate, validateReport } = require('./report-contract');

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function createAgentRunner({ invokeModel = invokeLlm, promptFiles = {} } = {}) {
  return async function runAgent(agentId, input, correlationId, options = {}) {
    const {
      cycle = 1,
      runtimeMode = config.runtimeMode,
      runsDir = config.runsDir,
      auditFile = config.auditFile
    } = options;
    const agent = registry[agentId];
    const artifactOptions = { cycle, runsDir };
    const audit = {
      correlationId,
      workflow: config.workflowName,
      agent: agentId,
      model: agent?.model,
      runtimeMode,
      cycle,
      timestamp: new Date().toISOString()
    };
    const persist = (stage, value) => writeArtifact(
      correlationId, agentId, value, { ...artifactOptions, stage }
    );
    let phase = 'INPUT_FAILURE';
    let provenance;
    try {
      requireContract(agent && agent.isolatedContext && agent.allowedTools.length === 0,
        'Unknown agent or invalid isolation/tool boundary.');
      requireContract(['mock', 'real'].includes(runtimeMode), 'Runtime mode must be mock or real.');
      requireContract(Number.isInteger(cycle) && cycle > 0, 'Review cycle must be a positive integer.');
      requireContract(input && typeof input === 'object' && !Array.isArray(input)
        && agent.requiredInputs.every(key => Object.hasOwn(input, key))
        && Object.keys(input).every(key => agent.allowedInputs.includes(key)),
      'Agent input violates its allowlist.');
      if (Object.hasOwn(input, 'ticket')) {
        requireContract(typeof input.ticket === 'string' && Boolean(input.ticket.trim()),
          'Ticket must be nonblank text.');
      }
      input = JSON.parse(JSON.stringify(input));
      const promptFile = path.resolve(__dirname, '..', promptFiles[agentId] || agent.promptFile);
      const schemaFile = path.resolve(__dirname, '..', agent.schemaFile);
      const variables = { ...input, reviewCycle: cycle };
      if (agentId === 'adversarial-reviewer') {
        variables.previousReview = input.previousReview || null;
        variables.outputSchema = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));
      }
      if (agentId === 'final-review-writer') {
        variables.reportTemplate = reportTemplate(input);
      }
      const prompt = buildPrompt(loadPrompt(promptFile), variables);
      provenance = {
        ...audit,
        modelSettings: { temperature: 0 },
        inputHash: hash(JSON.stringify(input)),
        ticketHash: input.ticket ? hash(input.ticket) : null,
        promptHash: hash(prompt),
        promptTemplateHash: hash(fs.readFileSync(promptFile)),
        schemaHash: hash(fs.readFileSync(schemaFile)),
        governancePolicyHash: hash(fs.readFileSync(path.join(__dirname, 'governance-policy.js'))),
        reportContractHash: hash(fs.readFileSync(path.join(__dirname, 'report-contract.js')))
      };
      phase = 'ARTIFACT_FAILURE';
      persist('input', input);
      persist('prompt', prompt);
      persist('request', provenance);

      if (process.env.DEBUG === 'true') {
        console.log('Runtime mode:', runtimeMode);
        console.log('Agent:', agentId);
      }

      //const output = mockResponses[agentId];
      let output;
      let response;
      phase = 'MODEL_FAILURE';
      if (runtimeMode === 'mock') {
        output = typeof mockResponses[agentId] === 'function'
          ? mockResponses[agentId](input)
          : JSON.parse(JSON.stringify(mockResponses[agentId]));
        response = { content: JSON.stringify(output) };
      } else {
        response = await invokeModel({
          model: agent.model,
          prompt,
          temperature: 0
        });
      }
      phase = 'ARTIFACT_FAILURE';
      const rawArtifact = persist('raw', response.content);
      // require('fs').writeFileSync(
      //   `runs/${correlationId}-${agentId}-raw.txt`,
      //   response.content
      // );

      //output = { rawOutput: response.content };
      phase = 'JSON_PARSE_FAILURE';
      output = JSON.parse(response.content);
      persist('parsed', output);

      phase = 'SCHEMA_FAILURE';
      const validation = validateSchema(output, schemaFile);
      if (!validation.valid) {
        throw Object.assign(
          contractError(`Schema validation failed for ${agentId}`, 'SCHEMA_FAILURE'),
          { details: validation.errors }
        );
      }
      phase = 'GOVERNANCE_FAILURE';
      if (agentId === 'requirement-interpreter') {
        validateInterpretationTransition(output, input);
      } else if (agentId === 'adversarial-reviewer') {
        validateReview(output, input);
      } else {
        validateReport(output, input);
      }

      phase = 'ARTIFACT_FAILURE';
      const validatedArtifact = persist('validated', output);
      const promptTokens = response.promptTokens || 0;
      const completionTokens = response.completionTokens || 0;
      const totalTokens = response.totalTokens || (promptTokens + completionTokens);
      const estimatedCost = estimateCost(promptTokens, completionTokens);
      const costMethod =
        `Estimated from pricing for ${agent.model} `
        + `($${config.pricing.inputPerMillion}/1M input, `
        + `$${config.pricing.outputPerMillion}/1M output)`;
      const resultAudit = {
        ...provenance,
        promptTokens,
        completionTokens,
        totalTokens,
        cost: estimatedCost,
        costMethod,
        rawHash: hash(response.content),
        outputHash: hash(JSON.stringify(output)),
        rawArtifact,
        validatedArtifact,
        status: 'SUCCESS'
      };
      persist('manifest', resultAudit);
      writeAuditEntry(resultAudit, auditFile);
      return {
        success: true,
        correlationId,
        agentId,
        cycle,
        runtimeMode,
        output,
        audit: resultAudit
      };
    } catch (error) {
      const failure = {
        ...audit,
        status: error.code === 'GOVERNANCE_FAILURE' ? error.code : phase,
        reason: phase === 'MODEL_FAILURE'
          ? 'Model request failed.'
          : phase === 'JSON_PARSE_FAILURE'
            ? 'Agent response was not valid JSON.'
            : error.message,
        provenance
      };
      if (error.details) {
        failure.details = error.details;
      }
      writeAuditEntry(failure, auditFile);
      throw Object.assign(contractError(failure.reason, failure.status), {
        correlationId,
        ...(error.details ? { details: error.details } : {})
      });
    }
  };
}

const runAgent = createAgentRunner();

module.exports = {
  runAgent,
  createAgentRunner
};