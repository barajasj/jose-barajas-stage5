const fs = require('fs');
const path = require('path');
const config = require('./config');

function writeAuditEntry(entry, auditFile = config.auditFile) {
  fs.mkdirSync(path.dirname(auditFile), { recursive: true });
  fs.appendFileSync(
    auditFile,
    JSON.stringify(entry) + '\n'
  );
}

module.exports = {
  writeAuditEntry
};