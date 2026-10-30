const { main } = require('./eval-runner');

if (require.main === module) main();

module.exports = require('./eval-runner');
