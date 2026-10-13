const fs = require('fs');

function requiresHumanReview() {

  const assessment =
    JSON.parse(
      fs.readFileSync(
        'substance-assessment.json',
        'utf8'
      )
    );

  return assessment
    .overallAssessment
    .humanReviewRequired;
}

module.exports = {
  requiresHumanReview
};