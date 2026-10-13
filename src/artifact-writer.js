const fs = require('fs');
const path = require('path');

function writeArtifact(
  correlationId,
  agentId,
  output
) {
  const runDir = path.join(
    'runs',
    correlationId
  );

  if (!fs.existsSync(runDir)) {
    fs.mkdirSync(runDir, {
      recursive: true
    });
  }

  const filename = path.join(
    runDir,
    `${agentId}.json`
  );

  fs.writeFileSync(
    filename,
    JSON.stringify(output, null, 2)
  );
}

module.exports = {
  writeArtifact
};