module.exports = {
  'd5-ticket1-review-cycle1': {
    inputHash: '68e81027a8b5a46e8eb07a424e8d3a0e8660be63e5959857a0738fb8341ecf03',
    rationale: [
      'The stated sum and edit response are captured, but five implementation questions remain unanswered and require owner clarification.'
    ],
    findings: {
      'GOLD-OPEN-0': {
        description: [
          'Neither source nor interpretation resolves which unit applies to Circuit Height and DX Coil Height.'
        ],
        action: [
          'Ask the ticket owner which measurement unit these height fields use.'
        ]
      },
      'GOLD-OPEN-1': {
        description: [
          'The required rounding method and precision for the summed DX Coil Height remain undefined.'
        ],
        action: [
          'Request the rounding and precision convention for the calculated total.'
        ]
      },
      'GOLD-OPEN-2': {
        description: [
          'The ticket supplies no acceptable range or other validation limits for Circuit Height.'
        ],
        action: [
          'Ask the owner to specify allowed Circuit Height values and validation limits.'
        ]
      },
      'GOLD-OPEN-3': {
        description: [
          'The ticket does not say whether adding or removing a Cooling Circuit must recalculate the total.'
        ],
        action: [
          'Confirm whether circuit-list changes also trigger recalculation.'
        ]
      },
      'GOLD-OPEN-4': {
        description: [
          'The ticket leaves user editability of the calculated DX Coil Height undetermined.'
        ],
        action: [
          'Ask whether users may edit the calculated height or whether it is system-controlled.'
        ]
      }
    }
  }
};
