import { Logger, LogLevel } from '../src';
import { type Writer } from '../src/Logger';

describe('works', () => {
    const writer: Writer = {
        log: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('calls expected method of writer', () => {
        it('info calls info', () => {
            const logger = new Logger(writer);
            const message = 'some message';
            logger.info(message);
            expect(writer.info).toHaveBeenCalledWith(expect.any(String), message);
        });

        it('debug calls log', () => {
            const logger = new Logger(writer);
            logger.currentLevel = LogLevel.Debug;
            const message = 'some message';
            logger.debug(message);
            expect(writer.log).toHaveBeenCalledWith(expect.any(String), message);
        });

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
            expect(writer.info).toHaveBeenCalledWith(expect.any(String), message);
        });
    });

    describe('log level', () => {
        it('by default has info log level', () => {
            const logger = new Logger(writer);
            expect(logger.currentLevel).toBe(LogLevel.Info);
        });
        it('switches log levels', () => {
            const logger = new Logger(writer);
            logger.currentLevel = LogLevel.Debug;
            expect(logger.currentLevel).toBe(LogLevel.Debug);
            logger.currentLevel = LogLevel.Info;
            expect(logger.currentLevel).toBe(LogLevel.Info);
            logger.currentLevel = LogLevel.Error;
            expect(logger.currentLevel).toBe(LogLevel.Error);
        });
        it('does not print message if debug is printed and info is selected', () => {
            const logger = new Logger(writer);
            const message = 'some message';
            expect(logger.currentLevel).toBe(LogLevel.Info);
            logger.debug(message);
            expect(writer.info).not.toHaveBeenCalled();
            expect(writer.log).not.toHaveBeenCalled();
            expect(writer.error).not.toHaveBeenCalled();
        });
        it('prints message if debug method is called and debug level is selected', () => {
            const logger = new Logger(writer);
            const message = 'some message';
            logger.currentLevel = LogLevel.Debug;
            logger.debug(message);
            expect(writer.info).not.toHaveBeenCalled();
            expect(writer.log).toHaveBeenCalled();
            expect(writer.error).not.toHaveBeenCalled();
        });
    });
});
