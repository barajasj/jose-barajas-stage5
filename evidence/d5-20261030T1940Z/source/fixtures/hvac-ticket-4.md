# Ticket 04

## Title

FW Series: UI Input validation and ranges for Coil Height

## Description
Coil Height of Water/Steam coils must be a multiple of specified value, round input to closest: 3/8" & 1/2" tube → multiple of 1.25"; 5/8" tube → multiple of 1.50"; 1" tube → multiple of 2.25"; Lamiflo coil → multiple of 9"; 3/8" tube w/ 1" spacing → multiple of 1"

## Acceptance Criteria

- Valid range: 1.25" to 100"
- The entered value must be a multiple of a coil-specific increment.
- If the entered value is not an exact multiple, round it to the nearest valid increment.
- Height increments by coil type/configuration:
  - 3/8" tube or 1/2" tube: Increment = 1.25"
  - 5/8" tube: Increment = 1.50"
  - 1" tube: Increment = 2.25"
  - Lamiflo coil: Increment = 9.00"
  - 3/8" tube with 1" spacing: Increment = 1.00"
- Examples:
  - Tube Size = 3/8" User enters 14.1" Nearest valid value = 13.75" (11 × 1.25)
  - Tube Size = 5/8" User enters 14.0" Nearest valid value = 13.5" (9 × 1.5)
  - Tube Size = 1" User enters 16.0" Nearest valid value = 15.75" (7 × 2.25)
  - Lamiflo coil User enters 20" Nearest valid value = 18"