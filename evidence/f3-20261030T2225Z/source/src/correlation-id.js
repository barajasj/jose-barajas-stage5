const { randomUUID } = require('crypto');

function generateCorrelationId() {
  return `HVAC-TICKET-${Date.now()}-${randomUUID()}`;
}

module.exports = {
  generateCorrelationId
};