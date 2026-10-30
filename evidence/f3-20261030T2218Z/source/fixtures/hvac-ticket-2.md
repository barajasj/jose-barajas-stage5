# Ticket 02

## Title

Autopopulate Unit Type and Unit Size

## Description

In the "CONDENSER TYPE" section:
- When a user selects the Condenser Type and the Refrigerant from their dropdowns, we should populate the Unit Type dropdown filtered by the condenser type and the refrigerant that was selected.
- After a user selects a Unit Type, we should populate the Unit Size dropdown filtered by the Refrigerant + Unit Type that was selected

## Acceptance Criteria

When we select the Condenser Type and the Refrigerant we should see the Unit Type dropdown filtered by Condenser Type + Refrigerant selected.
When we select the Unit Type, we should see the Unit Size dropdown filtered by Refrigerant + Unit Type selected.

## Relevant Discussion
The Refrigerants comes from an unitdesign api GET /dropdowns
the attribute to get Unit Type is SDCommonUnitTypeRefrigerant
for example, we sould filter by the "parent" that contains the refrigerant selected.
  "SDCommonUnitTypeRefrigerant": [
    {
      "id": 0,
      "display": "CU",
      "value": "CU",
      "parent": [
        "R-410A",
        "R-454B"
      ],
      "isActive": true
    },
    {
      "id": 2,
      "display": "CUE",
      "value": "CUE",
      "parent": [
        "R-410A",
        "R-454B",
        "R-513A"
      ],
      "isActive": true
    },..
]

The attribute for Unit Size is SDCommonUnitModelSizes
for example, we sould filter by the "parent" that contains both the refrigerant and the Unit Type selected.
	
"SDCommonUnitModelSizes": [
    {
      "id": 0,
      "display": "101",
      "value": "101",
      "parent": [
        "R-410A",
        "R-454B",
        "CU"
      ],
      "isActive": true
    },
    {
      "id": 1,
      "display": "103",
      "value": "103",
      "parent": [
        "R-410A",
        "R-454B",
        "CU"
      ],
      "isActive": true
    },...
]