# Ticket 03

## Title

FW Series: Condenser Configuration Inputs

## Description

Business value: Captures the detailed physical and environmental parameters for Air Cooled (AC) and Evaporative Cooled (EC) condensers, as well as per-circuit refrigeration configurations, enabling accurate ECS calculations.

When the user selects the Condenser Type "AC" or "EC", the corresponding input fields should be displayed.

### Condenser Inputs — Air Cooled (AC)

| Row | Detail | Input Type | Source | Unit | Default / Options | Notes |
|-----|--------|------------|--------|------|-------------------|-------|
| 1 | Design Ambient | Numeric Input | User / Default | °F / °C | 95°F | Echoed in output 3.7 |
| 2 | ASHRAE Summer Design | Numeric Input | User / Default | °F / °C | — | |
| 3 | Default Condenser | Checkbox | User | — | — | Condenser selection mode |
| 4 | High Amb. / Altit. Cond. | Checkbox | User | — | — | Condenser selection mode |
| 5 | Condenser Tube Material | Dropdown | User / Default | — | Copper | |
| 6 | Condenser Fin Material | Dropdown | User / Default | — | Aluminum | |
| 7 | Condenser Tube Size | Dropdown | User / Default | mm | 3/8, 3/8 w/ 1" spacing | |
| 8 | Condenser Fin Type | Dropdown | User / Default | — | Corrugated | |

### Condenser Inputs — Evaporative Cooled (EC)

| Row | Detail | Input Type | Source | Unit | Default / Options | Notes |
|-----|--------|------------|--------|------|-------------------|-------|
| 1 | Bank ID# | ID | System | — | — | |
| 2 | Copies of this Bank | Numeric Input | User | — | — | |
| 3 | EC Model | Dropdown | User | — | — | See Catalog |
| 4 | Wet Bulb Temperature | Numeric Input | User | °F / °C | — | |


## Acceptance Criteria

Given the AC/EC condenser parameters and per-circuit cooling configurations, 
When processed, 
Then the system outputs condenser and circuit-level configuration ready for ECS calculation.

Given the user is configuring an AC condenser, 
When they enter ambient design conditions and coil geometry, 
Then the system records the condenser parameters.

Given the user is configuring an EC condenser, 
When they enter the EC model and wet bulb temperature, 
Then the system records the EC condenser parameters.

Given the user configures an AC condenser, 
When they select Condenser Passes, 
Then the system shall display AutoOdd, AutoEven, and 2 through 41 in increments of 1 as options.

Given the user configures an AC condenser, 
When they select Roof Type, 
Then the system shall display the specified dark and light roof type options with and without parapet/shrouding.
