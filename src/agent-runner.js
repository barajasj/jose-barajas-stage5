/*
It becomes the single place responsible for:
Launching agents
Capturing model usage
Logging audit records
Returning structured results
*/

const config = require('./config');

const fs = require('fs');
const registry = require('./agent-registry');
const mockResponses = require('./mock-agent-responses');
const { writeAuditEntry } = require('./audit-logger');
const { validateSchema } = require('./schema-validator');
const { writeArtifact } = require('./artifact-writer');
const { estimateCost } = require('./cost-estimator');

const { invokeLlm } = require('./models/fireworks-client');
const { loadPrompt } = require('./prompt-loader');
const { buildPrompt } = require('./prompt-builder');

async function runAgent(
  agentId,
  input,
  correlationId
) {
  const agent = registry[agentId];
  if (!agent) {
    throw new Error(
      `Unknown agent: ${agentId}`
    );
  }

  if (process.env.DEBUG === 'true') {
    console.log('Runtime mode:', config.runtimeMode);
    console.log('Agent:', agentId);
  }

  //const output = mockResponses[agentId];
  let output;
  let response;

  if (config.runtimeMode === 'mock') {
    output = mockResponses[agentId];
  }
  else {
    const promptTemplate = loadPrompt(agent.promptFile);

    if (process.env.DEBUG === 'true') {
      console.log('INPUT');
      console.log(
        JSON.stringify(input, null, 2)
      );
    }

    const prompt = buildPrompt(promptTemplate, input);
    if (process.env.DEBUG === 'true') {
      console.log('PROMPT');
      console.log(prompt);
    }

    response = await invokeLlm({
      model: agent.model,
      prompt
    });
    
    if (process.env.DEBUG === 'true') {
      console.log(response.content);
    }

    fs.writeFileSync(`runs/${correlationId}-${agentId}-raw.txt`, response.content)
    // require('fs').writeFileSync(
    //   `runs/${correlationId}-${agentId}-raw.txt`,
    //   response.content
    // );

    //output = { rawOutput: response.content };
    try {
      output = JSON.parse(
        response.content
      );
    }
    catch (error) {
      writeAuditEntry({
        correlationId,
        workflow: 'hvac-ticket-governance',
        agent: agentId,
        model: agent.model,
        status: 'JSON_PARSE_FAILURE',
        error: error.message,
        timestamp: new Date().toISOString()
      });

      throw new Error(
        `JSON parsing failed for ${agentId}`
      );
    }
  }

  const validation = validateSchema(
    output,
    agent.schemaFile
  );

  if (!validation.valid) {
    writeAuditEntry({
      correlationId,
      workflow: 'hvac-ticket-governance',
      agent: agentId,
      model: agent.model,
      status: 'SCHEMA_FAILURE',
      errors: validation.errors,
      timestamp: new Date().toISOString()
    });

    throw new Error(
      `Schema validation failed for ${agentId}`
    );
  }

  writeArtifact(
    correlationId,
    agentId,
    output
  );

  const promptTokens = response?.promptTokens || 0;
  const completionTokens = response?.completionTokens || 0;
  const totalTokens =
    response?.totalTokens || (promptTokens + completionTokens);

  const estimatedCost = estimateCost(
    promptTokens,
    completionTokens
  );

  const costMethod = 
    `Estimated from pricing for ${agent.model} `
    + `($${config.pricing.inputPerMillion}/1M input, `
    + `$${config.pricing.outputPerMillion}/1M output)`;

  const auditEntry = {
    correlationId,
    workflow: 'hvac-ticket-governance',
    agent: agentId,
    model: agent.model,
    promptTokens,
    completionTokens,
    totalTokens,
    cost: estimatedCost,
    costMethod,
    status: 'SUCCESS',
    timestamp: new Date().toISOString()
  };

  writeAuditEntry(auditEntry);

  return {
    success: true,
    correlationId,
    agentId,
    output,
    audit: {
      model: agent.model,
      promptTokens,
      completionTokens,
      totalTokens,
      cost: estimatedCost,
      costMethod
    }
  };
}

module.exports = {
  runAgent
};