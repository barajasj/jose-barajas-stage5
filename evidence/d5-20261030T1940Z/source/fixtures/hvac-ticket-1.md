# Ticket 01

## Title

Calculate the DX Coil Height

## Description

As we enter in the Cooling Package (e.g. R-454B FW 43 ) - the system will run to Calculations and get the starting values.
The DX Coil Height is empty.
What we want to happen is:
- The Cooling Circuits are populated
- Then we sum the height for each Circuit to make the value that is to appear in the DX Coil Information.
- For exmaple We have 3 circuits, each with a height of 7.5
- so 7.5 + 7.5 + 7.5 = 22.5
- and should the user alter the Circuit Height - the form should react to this edit - resum all heights and update the Height field in DX Coil Information
