/* eslint-disable no-console */
import type { Writer } from '@adguard/logger/dist/types/Logger';
import { ExtendedLogger, LogLevel } from '@lib/common/utils/';

/**
 * Log writer mock.
 */
class LogWriterMock implements Writer { // fixme move to mocks
    log = jest.fn();

    info = jest.fn();

    error = jest.fn();
}

describe('logger', () => {
    let logWriter: Writer;
    let logger: ExtendedLogger;

    const callLoggerMethods = (): void => {
        logger.error('message');
        logger.warn('message');
        logger.debug('message');
        logger.info('message');
    };

    beforeEach(() => {
        logWriter = new LogWriterMock();
        logger = new ExtendedLogger(logWriter);
        logger.currentLevel = LogLevel.Error;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('logs only errors at default log level', () => {
        callLoggerMethods();

        expect(logWriter.log).not.toHaveBeenCalled();
        expect(logWriter.info).not.toHaveBeenCalled();
        expect(logWriter.error).toHaveBeenCalled();
    });

    it('calls Logger methods when verbose is set to true', () => {
        logger.setVerbose(true);
        logger.currentLevel = LogLevel.Debug;
        callLoggerMethods();
        expect(logWriter.log).toHaveBeenCalled();
        expect(logWriter.info).toHaveBeenCalled();
        expect(logWriter.error).toHaveBeenCalled();
    });

    it('does not call Logger methods when verbose is set to false', () => {
        logger.setVerbose(false);
        callLoggerMethods();
        expect(logWriter.log).not.toHaveBeenCalled();
        expect(logWriter.info).not.toHaveBeenCalled();
        // logger.error should be called regardless of 'verbose'
        expect(logWriter.error).toHaveBeenCalled();
    });

    it('uses LogLevel.Error correctly', () => {
        logger.currentLevel = LogLevel.Error;
        callLoggerMethods();

        expect(logWriter.log).not.toHaveBeenCalled();
        expect(logWriter.info).not.toHaveBeenCalled();
        expect(logWriter.error).toHaveBeenCalled();
    });

    it('uses LogLevel.Warn correctly', () => {
        logger.currentLevel = LogLevel.Warn;
        callLoggerMethods();

        expect(logWriter.log).not.toHaveBeenCalled();
        expect(logWriter.info).toHaveBeenCalled();
        expect(logWriter.error).toHaveBeenCalled();
    });

    it('uses LogLevel.Info correctly', () => {
        logger.currentLevel = LogLevel.Info;
        callLoggerMethods();

        expect(logWriter.log).not.toHaveBeenCalled();
        expect(logWriter.info).toHaveBeenCalled();
        expect(logWriter.error).toHaveBeenCalled();
    });

    it('uses LogLevel.Debug correctly', () => {
        logger.currentLevel = LogLevel.Debug;
        callLoggerMethods();

        expect(logWriter.log).toHaveBeenCalled();
        expect(logWriter.info).toHaveBeenCalled();
        expect(logWriter.error).toHaveBeenCalled();
    });

    it('throws error on invalid log level', () => {
        expect(() => {
            logger.currentLevel = 'invalid' as LogLevel;
        }).toThrow();
    });

    it('throws error on invalid verbose', () => {
        expect(() => logger.setVerbose('invalid' as unknown as boolean)).toThrow();
    });
});
