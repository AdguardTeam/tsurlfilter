/* eslint-disable no-console */
import { Logger, logLevelSchema, type LogLevel } from '@lib/common/utils/logger';

describe('logger', () => {
    let logger: Logger;

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

        logger = new Logger();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('logs only errors at default log level', () => {
        callLoggerMethods();

        expect(console.error).toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
        expect(console.info).not.toHaveBeenCalled();
        expect(console.debug).not.toHaveBeenCalled();
    });

    it('calls Logger methods when verbose is set to true', () => {
        logger.setVerbose(true);
        logger.setLogLevel(logLevelSchema.enum.debug);
        callLoggerMethods();
        expect(console.error).toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalled();
        expect(console.info).toHaveBeenCalled();
        expect(console.debug).toHaveBeenCalled();
    });

    it('does not call Logger methods when verbose is set to false', () => {
        logger.setVerbose(false);
        callLoggerMethods();
        // logger.error should be called regardless of 'verbose'
        expect(console.error).toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
        expect(console.info).not.toHaveBeenCalled();
        expect(console.debug).not.toHaveBeenCalled();
    });

    it('uses LogLevel.Error correctly', () => {
        logger.setLogLevel(logLevelSchema.enum.error);
        callLoggerMethods();

        expect(console.error).toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
        expect(console.info).not.toHaveBeenCalled();
        expect(console.debug).not.toHaveBeenCalled();
    });

    it('uses LogLevel.Warn correctly', () => {
        logger.setLogLevel(logLevelSchema.enum.warn);
        callLoggerMethods();

        expect(console.error).toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalled();
        expect(console.info).not.toHaveBeenCalled();
        expect(console.debug).not.toHaveBeenCalled();
    });

    it('uses LogLevel.Info correctly', () => {
        logger.setLogLevel(logLevelSchema.enum.info);
        callLoggerMethods();

        expect(console.error).toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalled();
        expect(console.info).toHaveBeenCalled();
        expect(console.debug).not.toHaveBeenCalled();
    });

    it('uses LogLevel.Debug correctly', () => {
        logger.setLogLevel(logLevelSchema.enum.debug);
        callLoggerMethods();

        expect(console.error).toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalled();
        expect(console.info).toHaveBeenCalled();
        expect(console.debug).toHaveBeenCalled();
    });

    it('throws error on invalid log level', () => {
        expect(() => logger.setLogLevel('invalid' as LogLevel)).toThrow();
    });

    it('throws error on invalid verbose', () => {
        expect(() => logger.setVerbose('invalid' as unknown as boolean)).toThrow();
    });
});
