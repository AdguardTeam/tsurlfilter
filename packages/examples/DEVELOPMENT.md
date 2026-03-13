# Development

This guide covers the development workflow for the example extensions in
`packages/examples/`.

## Prerequisites

- **Node.js**: v22 or later
- **pnpm**: v10 (managed via the monorepo root)
- **Browser**: Chromium-based (for MV3 examples) or Firefox (for MV2 examples)

## Getting Started

### Clone the Repository

The examples live inside the `tsurlfilter` monorepo:

```bash
git clone https://github.com/AdguardTeam/tsurlfilter.git
cd tsurlfilter
```

### Install Dependencies

From the **monorepo root**:

```bash
pnpm install
```

### Build Workspace Dependencies

Each example depends on core packages that must be built first. Use Lerna to
build an example with all its dependencies:

```bash
# AdGuard API MV2 example
npx lerna run build --scope adguard-api-example --include-dependencies

# AdGuard API MV3 example
npx lerna run build --scope adguard-api-mv3-example --include-dependencies

# TSWebExtension MV2 example
npx lerna run build --scope tswebextension-mv2 --include-dependencies

# TSWebExtension MV3 example
npx lerna run build --scope tswebextension-mv3 --include-dependencies
```

## Available Examples

| Package | Description | Manifest |
|---------|-------------|----------|
| `adguard-api-example` | Extension using `@adguard/api` | MV2 |
| `adguard-api-mv3-example` | Extension using `@adguard/api-mv3` | MV3 |
| `tswebextension-mv2` | Extension using `@adguard/tswebextension` directly | MV2 |
| `tswebextension-mv3` | Extension using `@adguard/tswebextension` directly | MV3 |

## Building Examples

From each example directory or from the monorepo root:

```bash
# From the example directory
cd packages/examples/<example-name>
pnpm build

# Or from the monorepo root via Lerna
npx lerna run build --scope <example-name>
```

### Browser-Specific Builds (tswebextension-mv2)

```bash
cd packages/examples/tswebextension-mv2

# Build for Chrome (default)
pnpm build:chrome

# Build for Firefox
pnpm build:ff
```

### MV3 Pre-compilation (tswebextension-mv3)

The MV3 example requires pre-compiling filter rules before building:

```bash
cd packages/examples/tswebextension-mv3
pnpm build   # runs build:precompile-rules then build:extension
```

## Loading in a Browser

1. Build the example (see above).
2. Open the browser's extension management page:
   - Chrome: `chrome://extensions/`
   - Firefox: `about:debugging#/runtime/this-firefox`
3. Enable "Developer mode" (Chrome) or click "Load Temporary Add-on"
   (Firefox).
4. Load the built extension from the example's `build/` directory.

## Testing

### Manual Testing

Use [test pages](https://testcases.agrd.dev) to validate filtering.

### Automated Browser Tests (tswebextension examples)

```bash
cd packages/examples/tswebextension-mv2
pnpm test

cd packages/examples/tswebextension-mv3
pnpm test
```

These use Playwright to run browser-based tests.

## Development Workflow

### Linting

```bash
cd packages/examples/<example-name>
pnpm lint
```

The `tswebextension-mv2` and `tswebextension-mv3` examples also have
`lint:code` and `lint:types` sub-commands.

### Cleaning Build Output

```bash
cd packages/examples/<example-name>
pnpm clean   # available in tswebextension examples
```

## Troubleshooting

### Issue: Dependencies fail to install

**Solution**: Clean and reinstall from the monorepo root:

```bash
pnpm ri
```

### Issue: Build fails with workspace dependency errors

**Solution**: Build with dependencies using Lerna:

```bash
npx lerna run build --scope <example-name> --include-dependencies
```

### Issue: Playwright not installed

**Solution**: Install Playwright browsers:

```bash
npx playwright install
```

## Additional Resources

- [AGENTS.md](AGENTS.md) — AI agent instructions for examples
- [Root DEVELOPMENT.md](../../DEVELOPMENT.md) — Monorepo-wide development guide
- [Test pages](https://testcases.agrd.dev) — Test cases for validating
  filtering behavior
