const fs = require('fs');

function writeAuditEntry(entry) {
  fs.appendFileSync(
    'audit/audit-log.jsonl',
    JSON.stringify(entry) + '\n'
  );
}

module.exports = {
  writeAuditEntry
};