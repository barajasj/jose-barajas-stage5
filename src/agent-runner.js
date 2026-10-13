/*
It becomes the single place responsible for:
Launching agents
Capturing model usage
Logging audit records
Returning structured results
*/

const registry = require('./agent-registry');
const mockResponses = require('./mock-agent-responses');
const { writeAuditEntry } = require('./audit-logger');
const { validateSchema } = require('./schema-validator');
const { writeArtifact} = require('./artifact-writer');

async function runAgent(
  agentId,
  input,
  correlationId
) {
  const agent = registry[agentId];
  const output =  mockResponses[agentId];
  const validation = validateSchema(output, agent.schemaFile);

  if (!validation.valid) {
    writeAuditEntry({
      correlationId,
      workflow: 'hvac-ticket-governance',
      agent: agentId,
      model: 'swe-1.7',
      status: 'SCHEMA_FAILURE',
      errors: validation.errors,
      timestamp: new Date().toISOString()
    });

    throw new Error(
      `Schema validation failed for ${agentId}`
    );
  }

  writeArtifact(correlationId, agentId, output);

  // TODO:
  // load prompt

  // TODO:
  // call SWE-1.7

  // TODO:
  // validate schema

  // TODO:
  // write audit

  const auditEntry = {
    correlationId,
    workflow: 'hvac-ticket-governance',
    agent: agentId,
    model: 'swe-1.7',
    promptTokens: 100,
    completionTokens: 50,
    cost: 0.001,
    status: 'SUCCESS',
    timestamp: new Date().toISOString()
  };
  
  writeAuditEntry(auditEntry);

  return {
    success: true,
    correlationId,
    agentId,
    output: mockResponses[agentId], //{}, // TODO: temporal mock to test
    audit: {
      model: 'swe-1.7',
      promptTokens: 100,
      completionTokens: 50,
      cost: 0.001
    }
  };
}

module.exports = {
  runAgent
};