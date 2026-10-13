function generateCorrelationId() {
  return `HVAC-TICKET-${Date.now()}`;
}

module.exports = {
  generateCorrelationId
};