require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');

const { executeWorkflow } = require('./coordinator');

async function main() {
  const ticketPath = process.argv[2];
  const outputPath = process.argv[3];

  const ticket = fs.readFileSync(ticketPath, 'utf8');

  const result = await executeWorkflow(ticket);
  if (!['COMPLETED', 'COMPLETED_AFTER_HUMAN_APPROVAL'].includes(result.status)) {
    process.exitCode = 1;
  }
  const jsonOutput = JSON.stringify(result, null, 2);

  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, jsonOutput + '\n', 'utf8');
  }

  console.log(jsonOutput);
}

main().catch(() => {
  process.exitCode = 1;
  console.error(JSON.stringify({
    status: 'WORKFLOW_FAILURE',
    disposition: 'FAIL',
    reason: 'Unable to read workflow inputs or persist workflow output.'
  }));
});