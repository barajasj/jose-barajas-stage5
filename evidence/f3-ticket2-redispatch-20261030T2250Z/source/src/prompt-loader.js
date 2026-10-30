const fs = require('fs');

function loadPrompt(path) {
  return fs.readFileSync(
    path,
    'utf8'
  );
}

module.exports = {
  loadPrompt
};