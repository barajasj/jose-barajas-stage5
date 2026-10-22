# CONTINUE Decision Evidence

Two evidence sources demonstrate the CONTINUE path:

1. Live workflow run (below): a recorded human
   CONTINUE allowed the coordinator to complete the
   pipeline and produce the final report.
2. Active gate test: scenarios `S3-explicit-continue`
   and `S8-fresh-decision-honored` in
   `src/test-punchout.js` assert that a valid CONTINUE
   returns `COMPLETED_AFTER_HUMAN_APPROVAL` with an
   explicit `humanGovernance` record and a
   `HUMAN_APPROVED_CONTINUE` audit entry. See
   `runs/punchout-test-results.json`.

## Live Run Output

HIGH severity finding detected. Re-dispatching...
{
  "correlationId": "HVAC-TICKET-1791910318137",
  "interpreterResult": {
    "success": true,
    "correlationId": "HVAC-TICKET-1791910318137",
    "agentId": "requirement-interpreter",
    "output": {
      "requirementSummary": "DX Coil Height is calculated as the sum of all Cooling Circuit Heights.",
      "hvacTerminology": [
        "DX Coil",
        "Cooling Circuit"
      ],
      "businessRules": [
        "DX Coil Height equals the sum of all Cooling Circuit Heights."
      ],
      "developerConsiderations": [
        "Implement automatic recalculation."
      ],
      "ambiguities": [],
      "confidence": "HIGH"
    },
    "audit": {
      "model": "swe-1.7",
      "promptTokens": 100,
      "completionTokens": 50,
      "cost": 0.001
    }
  },
  "reviewResult": {
    "success": true,
    "correlationId": "HVAC-TICKET-1791910318137",
    "agentId": "adversarial-reviewer",
    "output": {
      "status": "FAIL",
      "findings": [
        {
          "severity": "HIGH",
          "description": "Behavior when no cooling circuits exist is undefined."
        }
      ]
    },
    "audit": {
      "model": "swe-1.7",
      "promptTokens": 100,
      "completionTokens": 50,
      "cost": 0.001
    }
  },
  "finalInterpreterResult": {
    "success": true,
    "correlationId": "HVAC-TICKET-1791910318137",
    "agentId": "requirement-interpreter",
    "output": {
      "requirementSummary": "DX Coil Height is calculated as the sum of all Cooling Circuit Heights.",
      "hvacTerminology": [
        "DX Coil",
        "Cooling Circuit"
      ],
      "businessRules": [
        "DX Coil Height equals the sum of all Cooling Circuit Heights."
      ],
      "developerConsiderations": [
        "Implement automatic recalculation."
      ],
      "ambiguities": [],
      "confidence": "HIGH"
    },
    "audit": {
      "model": "swe-1.7",
      "promptTokens": 100,
      "completionTokens": 50,
      "cost": 0.001
    }
  },
  "finalReviewResult": {
    "success": true,
    "correlationId": "HVAC-TICKET-1791910318137",
    "agentId": "adversarial-reviewer",
    "output": {
      "status": "FAIL",
      "findings": [
        {
          "severity": "HIGH",
          "description": "Behavior when no cooling circuits exist is undefined."
        }
      ]
    },
    "audit": {
      "model": "swe-1.7",
      "promptTokens": 100,
      "completionTokens": 50,
      "cost": 0.001
    }
  },
  "finalReport": {
    "success": true,
    "correlationId": "HVAC-TICKET-1791910318137",
    "agentId": "final-review-writer",
    "output": {
      "reportMarkdown": "\n# FAIL\n\n## Summary\n\nCritical findings remain unresolved.\n\n## Reviewer Findings\n\n- Behavior when no cooling circuits exist is undefined.\n\n## Final Disposition\n\nFAIL\n"
    },
    "audit": {
      "model": "swe-1.7",
      "promptTokens": 100,
      "completionTokens": 50,
      "cost": 0.001
    }
  }
}