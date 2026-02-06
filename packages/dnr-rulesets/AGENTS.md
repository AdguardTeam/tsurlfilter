# AGENTS.md

## Project Overview

<!--
  Provide a brief description of what this project does.
  Example: "A REST API for managing user accounts and authentication."
-->

## Technical Context

<!--
  Fill in the relevant fields below. Remove or add fields as needed for your project.
-->

- **Language/Version**: <!-- e.g., TypeScript 5.x, Python 3.12, Go 1.22 -->
- **Primary Dependencies**: <!-- e.g., Express, React, Django, FastAPI -->
- **Storage**: <!-- e.g., PostgreSQL, MongoDB, Redis, or "None" if not applicable -->
- **Testing**: <!-- e.g., Vitest, Jest, pytest, Go testing -->
- **Target Platform**: <!-- e.g., Node.js server, Browser, iOS/Android, Docker -->
- **Project Type**: <!-- single/web/mobile/monorepo -->
- **Performance Goals**: <!-- e.g., <100ms API response time, or "N/A" -->
- **Constraints**: <!-- e.g., Must run offline, memory-constrained, or "None" -->
- **Scale/Scope**: <!-- e.g., Internal tool for 10 users, SaaS for 10k+ users -->

## Project Structure

<!--
  Replace the placeholder tree below with your actual project structure.
  Include the most important directories and files with brief descriptions.
-->

```text
repo-name/
├── src/                      # Application source code
│   ├── dir1/                 # Directory description
│   └── dir2/                 # Directory description
└── test/                     # Test files
```

## Build And Test Commands

<!--
  List the commands developers need to build, test, lint, and run the project.
  Use the format: `command` - description
-->

- `command` - description

## Contribution Instructions

<!--
  Define the rules that AI agents (and human contributors) MUST follow.
  Customize these based on your project's tooling and workflow.
  Below are example instructions—modify or remove as needed.
-->

You MUST follow the following rules for EVERY task that you perform:

- You MUST verify your changes pass all static analysis checks before completing
  a task.

  <!--
    List your project's specific commands, e.g.:
    - `npm run build` to check for TypeScript errors
    - `npm run lint` to run ESLint
    - `npm run format` to check formatting
  -->

- You MUST update or add unit tests for any changed code.

- You MUST run the test suite to verify your changes do not break existing
  functionality.

  <!-- e.g., `npm test`, `pytest`, `go test ./...` -->

- When making changes to the project structure, ensure the Project Structure
  section in `AGENTS.md` is updated and remains valid.

- When the task is finished update `CHANGELOG.md` file and explain changes in
  the `Unreleased` section. Add entries to the appropriate subsection (`Added`,
  `Changed`, or `Fixed`) if it already exists; do not create duplicate
  subsections.

- If the prompt essentially asks you to refactor or improve existing code, check
  if you can phrase it as a code guideline. If it's possible, add it to
  the relevant Code Guidelines section in `AGENTS.md`.

- After completing the task you MUST verify that the code you've written
  follows the Code Guidelines in this file.

<!--
  Add any additional contribution rules specific to your project, such as:
  - Changelog maintenance requirements
  - Documentation update requirements
  - Code review requirements
  - Branch naming conventions
-->

## Code Guidelines

<!--
  Define your project's coding standards and architectural patterns.
  Organize guidelines into numbered sections by topic.
  Each guideline should include:
  - Clear, actionable rules (use MUST, SHOULD, MAY language)
  - A **Rationale** explaining why the rule exists

  Below are example sections—customize or replace entirely based on your
  project.
-->

### I. Architecture

<!--
  Describe your project's architectural patterns and layer responsibilities.
  Examples:
  - Service-layer architecture (handlers → services → repositories → database)
  - MVC pattern
  - Clean architecture / hexagonal architecture
  - Microservices boundaries
-->

### II. Code Quality Standards

<!--
  Define documentation and style requirements.
  Examples:
  - Public API documentation requirements (JSDoc, docstrings, etc.)
  - Static analysis tools that must pass (linter, type checker, formatter)
  - Error handling strategy (throw vs return errors, where to catch)
-->

### III. Testing Discipline

<!--
  Define testing requirements and practices.
  Examples:
  - Test file naming and location conventions
  - Mocking strategy (what to mock, what to test with real implementations)
  - Coverage requirements
  - Test categories (unit, integration, e2e)
-->

### IV. Other

<!--
  Add any additional guidelines that don't fit the categories above.
  Examples:
  - Logging conventions
  - Internationalization requirements
  - Security practices
  - Performance considerations
-->
