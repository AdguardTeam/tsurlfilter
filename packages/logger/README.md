# AdGuard Logger

AdGuard Logger is a simple tool designed for logging from AdGuard extensions.

## Usage

### Installation

```bash
pnpm add @adguard/logger
```

### Basic Usage

The package supports both CommonJS and ES Module import styles.

```javascript
const { Logger } = require('@adguard/logger');
// or
import { Logger } from '@adguard/logger';

const logger = new Logger();
logger.info('This is an info message');
```

The default log level is set to `info`, meaning that messages at the `debug` level won't be logged. You can adjust this by setting the log level:

```typescript
import { Logger, LogLevel } from './Logger';

const logger = new Logger();
logger.currentLevel = LogLevel.Debug;
console.log(logger.currentLevel); // Outputs 'debug'
logger.debug('This is a debug message');
```

Additionally, you can customize your logging solution by providing your own log writer, rather than relying solely on the default `console` logger:

```typescript
import { Logger, LogLevel } from './Logger';

const writeToFile = (...args: any[]) => {
// Implement file writing logic here
};
const writer = {
    log: (...args: any[]): void => {
        writeToFile(...args);
        console.log(...args);
    },
    error: (...args: any[]): void => {
        writeToFile(...args);
        console.error(...args);
    },
    info: (...args: any[]): void => {
        writeToFile(...args);
        console.info(...args);
    },
};
const logger = new Logger(writer);
```

#### Verbose logging and trace output

This mode is designed solely for development and debugging purposes, providing clickable call stack traces in the console for maximum insight into code execution.

When the logger is set to `LogLevel.Verbose`, every log method except `error()` will print with a call stack trace. This helps track the flow of execution and diagnose complex issues. The stack trace is shown as a collapsed group in the console if the writer supports `groupCollapsed` and `groupEnd`, making logs more readable; otherwise, traces are printed expanded.

To enable this behavior, the following conditions must be met:
- Logging level must be set to `LogLevel.Verbose`.
- The log method must not be `error()` (since `error()` already includes a stack trace).

This feature is intended for developers who need detailed, step-by-step tracking of application execution.

## Development

To contribute to the development of AdGuard Logger, follow these steps:

### Install dependencies

```bash
pnpm install
```

### Run tests

```bash
pnpm test
```

### Build

```bash
pnpm build
```

### Lint

```bash
pnpm lint
```

## Limitations

Development of this library was tested only on macOS, so some scripts may not work on Windows.
