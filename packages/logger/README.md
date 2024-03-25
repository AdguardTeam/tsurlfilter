# AdGuard Logger

AdGuard Logger is a simple tool designed for logging from AdGuard extensions.

## Usage

### Installation
```bash
yarn add @adguard/logger
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
