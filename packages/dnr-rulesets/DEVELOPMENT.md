# Development

This guide covers the development workflow, environment setup, and best
practices for contributing to this project.

## Prerequisites

<!--
  List required tools and versions needed to develop this project.
  Example:
  - Node.js 20.x or later
  - pnpm 9.x
  - Docker (for running local services)
-->

- **Required Tools**: <!-- e.g., Node.js 20.x, Python 3.12, Go 1.22 -->
- **Package Manager**: <!-- e.g., pnpm, npm, pip, cargo -->
- **Optional Tools**: <!-- e.g., Docker, Make, direnv -->

## Getting Started

### Clone the Repository

```bash
git clone <repository-url>
cd <project-name>
```

### Install Dependencies

<!--
  Provide the command(s) to install project dependencies.
  Example: `pnpm install`
-->

```bash
# Install dependencies
```

### Environment Setup

<!--
  Describe any environment configuration needed.
  Example: Copy `.env.example` to `.env` and fill in required values.
-->

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

2. Configure required environment variables (see `.env.example` for details).

### Running Locally

<!--
  Provide commands to run the project in development mode.
-->

```bash
# Start the development server
```

## Development Workflow

### Branch Strategy

<!--
  Describe your branching model.
  Example: feature branches off main, PR-based workflow.
-->

- Create feature branches from `main`
- Use descriptive branch names: `feature/add-auth`, `fix/login-bug`
- Open a pull request when ready for review

### Code Style

<!--
  Reference your linting/formatting setup.
-->

This project uses automated formatting and linting. Run these before committing:

```bash
# Format code
# Lint code
```

### Running Tests

<!--
  Provide commands for running tests.
-->

```bash
# Run all tests
# Run tests in watch mode
# Run tests with coverage
```

### Building for Production

<!--
  Provide commands for production builds.
-->

```bash
# Build for production
```

## Common Tasks

<!--
  Add project-specific common tasks developers frequently perform.
  Examples:
  - Adding a new API endpoint
  - Running database migrations
  - Generating types from schema
-->

### Adding a New Feature

1. Create a feature branch
2. Implement the feature with tests
3. Ensure all checks pass
4. Open a pull request

### Debugging

<!--
  Describe debugging setup and tips.
  Example: VS Code launch configurations, logging levels.
-->

## Troubleshooting

<!--
  Document common issues and their solutions.
-->

### Issue: Dependencies fail to install

**Solution**: Clear the cache and reinstall:

```bash
# Clear cache and reinstall
```

### Issue: Tests fail on first run

**Solution**: Ensure all required services are running and environment is
configured.

## Additional Resources

<!--
  Link to related documentation.
-->

- [README.md](README.md) - Project overview
- [AGENTS.md](AGENTS.md) - AI agent instructions and code guidelines
- [CHANGELOG.md](CHANGELOG.md) - Version history
