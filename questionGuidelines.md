# Question Creation Guidelines

## P1 — Problem Statement
- Must include a real-world scenario with a **named character** (e.g., Riya, Marcus, Dr. Chen)
- Clear, unambiguous instructions; state all formulas explicitly if calculations involved
- No duplicate example block; no grammar errors; describe what the program must do

## P2 — Input Format
Use this exact style for every line:
> The first line of input consists of an integer N representing the number of elements.
> The second line of input consists of N space-separated integers representing the array elements.

Rules: state datatype, separator (space/comma), and what each value represents. No declarative statements ("Enter X").

## P3 — Output Format
Use this exact style for every line:
> The first line of output consists of a string in the format "Sum is X" where X is the sum.
> The first line of output consists of the string "Invalid input" when any constraint is violated.

Rules: state exact print strings, decimal precision, no trailing spaces, describe every possible output case (valid + all error cases).

## P4 — Constraints
- Constrain ALL input variables with valid ranges
- If invalid inputs are tested, state explicitly: "Input can be any integer. Valid range is X–Y. Out-of-range inputs trigger 'Invalid input'."
- Data types must match input format

## P5 — Sample Input
- Minimum 2, maximum 3 samples; each covers a different output scenario
- Raw values only — no "Line 1:" prefix, no descriptive text
- Must not duplicate hidden test cases; must match input format and constraints

## P6 — Sample Output
- Manually verify each output against solution logic
- Raw values only — no labels, no extra text
- Decimal places must match output format spec; no trailing spaces or blank lines

## P7 — Solution
**ZERO comment lines — no //, no /* */, no #, no inline comments, no commented-out code.**
(Exception: Python `if __name__ == '__main__':` is allowed.)

- No `<cstdlib>` in C/C++ (use `<stdlib.h>`); no out-of-syllabus STL
- No Variable Length Arrays (VLA) in C/C++
- No NullPointerException risk — always null-check
- No trailing spaces in output; use space-before pattern for lists
- Solution output must exactly match all sample outputs

**Header / Footer split (when required):**
- **Header**: ALL class definitions, method implementations, helper functions, business logic
- **Footer (main)**: ONLY variable declarations, input reading, function/method calls, final output printing
- Footer MUST NOT contain: if/else chains, switch, processing loops, business logic, calculations, output formatting decisions

## P8 — Hidden Test Cases
**Exactly 6 test cases — no more, no fewer.**
- Weightage in ASCENDING order totalling exactly 100: `Easy=10, Easy=10, Medium=15, Medium=15, Hard=25, Hard=25`
- All 6 unique — no duplicate inputs or outputs
- Manually verify each output against solution logic
- No trailing spaces in expected outputs
- Coverage: min, max, boundary, edge cases, invalid input (if applicable), at least 1 TC per output type

## Difficulty Reference
| Level  | Weightage | Topics |
|--------|-----------|--------|
| Easy   | 10        | if/else, loops, basic arrays, basic strings, simple functions |
| Medium | 15        | 2D arrays, pointers, structs/unions, basic OOP, exception handling |
| Hard   | 25        | Multiple inheritance, polymorphism, templates, STL, complex pointers, file handling+OOP |

## Key Rules (Non-Negotiable)
1. Input/Output format lines MUST start with "The Nth line of input/output consists of..."
2. Sample input/output blocks contain ONLY raw values
3. NEVER include comments in solution code
4. Exactly 6 hidden TCs, ascending weightage, total = 100
5. Footer must only contain: declarations, input reading, function calls, output printing
6. Named character + real-world context required in every problem statement
7. No trailing spaces anywhere — samples, expected outputs, solution output code
