const fs = require('fs');

function loadHumanDecisions() {

  if (!fs.existsSync('human-decisions.jsonl')) {
    return [];
  }

  const lines =
    fs.readFileSync(
      'human-decisions.jsonl',
      'utf8'
    )
    .split('\n')
    .filter(Boolean);

  return lines.map(line =>
    JSON.parse(line)
  );
}

function getLatestDecision() {

  const decisions = loadHumanDecisions();

  if (!decisions.length) {
    return null;
  }

  return decisions[
    decisions.length - 1
  ];
}

module.exports = {
  getLatestDecision
};