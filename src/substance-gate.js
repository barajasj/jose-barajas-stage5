const fs = require('fs');

function requiresHumanReview() {

  const assessment =
    JSON.parse(
      fs.readFileSync(
        'substance-assessment.json',
        'utf8'
      )
    );

  const workflows = Array.isArray(assessment.workflows)
    ? assessment.workflows
    : [];

  const toyCount = workflows.filter(
    w => w.classification === 'TOY'
  ).length;

  const peripheralCount = workflows.filter(
    w => w.classification === 'PERIPHERAL'
  ).length;

  if (toyCount >= 1 || peripheralCount >= 2) {
    return true;
  }

  return Boolean(
    assessment
      .overallAssessment
      ?.humanReviewRequired
  );
}

module.exports = {
  requiresHumanReview
};