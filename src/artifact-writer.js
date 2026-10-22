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

  if (fs.existsSync(filename)) {
    const pass1Filename = path.join(
      runDir,
      `${agentId}-pass1.json`
    );
    if (!fs.existsSync(pass1Filename)) {
      fs.copyFileSync(filename, pass1Filename);
    }
  }

  fs.writeFileSync(
    filename,
    JSON.stringify(output, null, 2)
  );
}

module.exports = {
  writeArtifact
};