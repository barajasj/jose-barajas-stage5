const fs = require('fs');
const path = require('path');
const config = require('./config');

function writeArtifact(
  correlationId,
  agentId,
  output,
  options = {}
) {
  const { cycle = 1, stage = 'validated', runsDir = config.runsDir } = options;
  if (!/^[A-Za-z0-9_-]+$/.test(correlationId)
    || !/^[A-Za-z0-9_-]+$/.test(agentId)
    || !/^[A-Za-z0-9_-]+$/.test(stage)
    || !Number.isInteger(cycle) || cycle < 1) {
    throw new Error('Invalid artifact identity.');
  }
  const runDir = path.join(
    runsDir,
    correlationId,
    `cycle-${cycle}`
  );

  if (!fs.existsSync(runDir)) {
    fs.mkdirSync(runDir, {
      recursive: true
    });
  }

  const filename = path.join(
    runDir,
    `${agentId}-${stage}.${typeof output === 'string' ? 'txt' : 'json'}`
  );

  fs.writeFileSync(
    filename,
    typeof output === 'string' ? output : JSON.stringify(output, null, 2),
    { encoding: 'utf8', flag: 'wx' }
  );
  return filename;
}

module.exports = {
  writeArtifact
};