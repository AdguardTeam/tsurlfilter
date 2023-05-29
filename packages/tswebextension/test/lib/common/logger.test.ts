/* eslint-disable no-console */
import {
    Logger,
    LogLevelType,
    LogLevelName,
} from '../../../src/lib/common';
import { appContext } from '../../../src/lib/mv2/background/context';

jest.mock('../../../src/lib/mv2/background/context', () => ({
    appContext: {
        configuration: {},
    },
}));

const setVerbose = (value: boolean | undefined): void => {
    if (appContext.configuration) {
        appContext.configuration.verbose = value;
    }
};

const setLogLevel = (value: LogLevelType): void => {
    if (appContext.configuration) {
        appContext.configuration.logLevel = value;
    }
};

describe('logger', () => {
    const logger = new Logger();

    const callLoggerMethods = (): void => {
        logger.error('message');
        logger.warn('message');
        logger.debug('message');
        logger.info('message');
    };

    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(jest.fn);
        jest.spyOn(console, 'warn').mockImplementation(jest.fn);
        jest.spyOn(console, 'info').mockImplementation(jest.fn);
        jest.spyOn(console, 'debug').mockImplementation(jest.fn);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        setVerbose(undefined);
        setLogLevel(undefined);
    });

    it('logs  only  errors at default log level', () => {
        callLoggerMethods();

        expect(console.error).toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
        expect(console.info).not.toHaveBeenCalled();
        expect(console.debug).not.toHaveBeenCalled();
    });

    it('calls Logger methods when verbose is set to true', () => {
        setVerbose(true);
        setLogLevel(LogLevelName.Debug);
        callLoggerMethods();
        expect(console.error).toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalled();
        expect(console.info).toHaveBeenCalled();
        expect(console.debug).toHaveBeenCalled();
    });

    it('does not call Logger methods when verbose is set to false', () => {
        setVerbose(false);
        callLoggerMethods();
        // logger.error should be called regardless of 'verbose'
        expect(console.error).toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
        expect(console.info).not.toHaveBeenCalled();
        expect(console.debug).not.toHaveBeenCalled();
    });

    it('uses LogLevel.Error correctly', () => {
        setLogLevel(LogLevelName.Error);
        callLoggerMethods();

        expect(console.error).toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
        expect(console.info).not.toHaveBeenCalled();
        expect(console.debug).not.toHaveBeenCalled();
    });

    it('uses LogLevel.Warn correctly', () => {
        setLogLevel(LogLevelName.Warn);
        callLoggerMethods();

        expect(console.error).toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalled();
        expect(console.info).not.toHaveBeenCalled();
        expect(console.debug).not.toHaveBeenCalled();
    });

    it('uses LogLevel.Info correctly', () => {
        setLogLevel(LogLevelName.Info);
        callLoggerMethods();

        expect(console.error).toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalled();
        expect(console.info).toHaveBeenCalled();
        expect(console.debug).not.toHaveBeenCalled();
    });

    it('uses LogLevel.Debug correctly', () => {
        setLogLevel(LogLevelName.Debug);
        callLoggerMethods();

        expect(console.error).toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalled();
        expect(console.info).toHaveBeenCalled();
        expect(console.debug).toHaveBeenCalled();
    });

    it('throws error on invalid log level', () => {
        setLogLevel('invalid' as LogLevelType);

        expect(() => logger.error('message'))
            .toThrow(`Logger only supports following levels: ${[Object.values(LogLevelName).join(', ')]}`);
    });
});
