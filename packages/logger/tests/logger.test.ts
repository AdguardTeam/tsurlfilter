import {
    describe,
    afterEach,
    it,
    expect,
    vi,
} from 'vitest';

import { Logger, LogLevel } from '../src';
import { type Writer } from '../src/Logger';

describe('checking that ', () => {
    const writer: Writer = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
    };

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('logs any message', () => {
        it('logs null', () => {
            const logger = new Logger(writer);
            logger.info('test', null);
            expect(writer.info).toHaveBeenCalledWith(expect.any(String), 'test', 'null');
        });

        it('logs undefined', () => {
            const logger = new Logger(writer);
            logger.info('test', undefined);
            expect(writer.info).toHaveBeenCalledWith(expect.any(String), 'test', 'undefined');
        });
    });

    describe('calls expected method of writer with default log level', () => {
        it('error calls error', () => {
            const logger = new Logger(writer);
            const message = 'some message';
            logger.error(message);
            expect(writer.error).toHaveBeenCalledWith(expect.any(String), message);
        });

        it('warn calls warn', () => {
            const logger = new Logger(writer);
            const message = 'some message';
            logger.warn(message);
            expect(writer.warn).toHaveBeenCalledWith(expect.any(String), message);
        });

        it('info calls info', () => {
            const logger = new Logger(writer);
            const message = 'some message';
            logger.info(message);
            expect(writer.info).toHaveBeenCalledWith(expect.any(String), message);
        });

        it('debug not called', () => {
            const logger = new Logger(writer);
            const message = 'some message';
            logger.debug(message);
            expect(writer.debug).not.toHaveBeenCalled();
        });

        it('trace not called', () => {
            const logger = new Logger(writer);
            const message = 'some message';
            logger.trace(message);
            expect(writer.trace).not.toHaveBeenCalled();
        });
    });

    describe('log level', () => {
        it('by default has info log level', () => {
            const logger = new Logger(writer);
            expect(logger.currentLevel).toBe(LogLevel.Info);
        });

        it('switches log levels', () => {
            const logger = new Logger(writer);

            Object.values(LogLevel).forEach((level) => {
                logger.currentLevel = level;
                expect(logger.currentLevel).toBe(level);
            });
        });

        it('does not print message if debug is called and info level is selected', () => {
            const logger = new Logger(writer);
            const message = 'some message';

            expect(logger.currentLevel).toBe(LogLevel.Info);
            logger.debug(message);

            expect(writer.error).not.toHaveBeenCalled();
            expect(writer.warn).not.toHaveBeenCalled();
            expect(writer.info).not.toHaveBeenCalled();
            expect(writer.debug).not.toHaveBeenCalled();
            expect(writer.trace).not.toHaveBeenCalled();
        });

        it('prints message if debug method is called and debug level is selected', () => {
            const logger = new Logger(writer);
            const message = 'some message';

            // Just spy on the debug and trace methods without changing theirs
            // implementations.
            const loggerDebugSpy = vi.spyOn(logger, 'debug');
            const loggerTraceSpy = vi.spyOn(logger, 'trace');

            logger.currentLevel = LogLevel.Debug;
            logger.debug(message);

            expect(writer.error).not.toHaveBeenCalled();
            expect(writer.warn).not.toHaveBeenCalled();
            expect(writer.info).not.toHaveBeenCalled();

            // Check logger method
            expect(logger.debug).toHaveBeenCalledOnce();
            // Check writer method 'trace' since with Debug level we call trace
            // method to capture stack trace and help identify the location
            // of the log.
            expect(writer.trace).toHaveBeenCalledOnce();

            expect(logger.trace).not.toHaveBeenCalled();

            // Clean up
            loggerDebugSpy.mockRestore();
            loggerTraceSpy.mockRestore();
        });

        it('does not print with trace method if error is called and level is not enough', () => {
            const logger = new Logger(writer);
            const message = 'some message';

            logger.currentLevel = LogLevel.Debug;
            logger.error(message);

            expect(writer.error).toHaveBeenCalledOnce();
            expect(writer.warn).not.toHaveBeenCalled();
            expect(writer.info).not.toHaveBeenCalled();
            expect(writer.debug).not.toHaveBeenCalled();
            expect(writer.trace).not.toHaveBeenCalled();
        });

        it('if level is warn - print with regular methods for all channels', () => {
            const logger = new Logger(writer);
            const message = 'some message';
            logger.currentLevel = LogLevel.Warn;

            logger.error(message);
            logger.warn(message);
            logger.info(message);
            logger.debug(message);
            logger.trace(message);

            expect(writer.error).toHaveBeenCalledOnce();
            expect(writer.warn).toHaveBeenCalledOnce();
            // Since level is not enough.
            expect(writer.info).not.toHaveBeenCalled();
            expect(writer.debug).not.toHaveBeenCalled();
            expect(writer.trace).not.toHaveBeenCalled();
        });

        it('if level is debug - print with trace from all channels except error', () => {
            const logger = new Logger(writer);
            const message = 'some message';
            logger.currentLevel = LogLevel.Debug;

            logger.error(message);
            logger.warn(message);
            logger.info(message);
            logger.debug(message);
            logger.trace(message);

            // Because if log level is Debug or Trace, we call trace method in writer
            // to capture stack trace and help identify the location of the log.
            // 3 times for warn, info and debug, trace is ignored since log level
            // is Debug.
            expect(writer.trace).toHaveBeenCalledTimes(3);
            // But we do not call trace writer method for error in any case.
            expect(writer.error).toHaveBeenCalledOnce();
        });

        it('if level is verbose - print with trace from all channels except error', () => {
            const logger = new Logger(writer);
            const message = 'some message';
            logger.currentLevel = LogLevel.Verbose;

            logger.error(message);
            logger.warn(message);
            logger.info(message);
            logger.debug(message);
            logger.trace(message);

            // Because if log level is Debug or Trace, we call trace method in writer
            // to capture stack trace and help identify the location of the log.
            expect(writer.trace).toHaveBeenCalledTimes(4);
            // But we do not call trace writer method for error in any case.
            expect(writer.error).toHaveBeenCalledOnce();
        });
    });
});
