const fs = require('fs');
const path = require('path');

const { executeWorkflow } = require('./coordinator');

async function main() {
  const ticketPath = process.argv[2];

  const ticket = fs.readFileSync(ticketPath, 'utf8');

  const result = await executeWorkflow(ticket);

  console.log(
    JSON.stringify(result, null, 2)
  );
}

main();