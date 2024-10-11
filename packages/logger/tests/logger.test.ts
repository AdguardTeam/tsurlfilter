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
            logger.currentLevel = LogLevel.Trace;
            expect(logger.currentLevel).toBe(LogLevel.Trace);
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

        describe('log level -- trace', () => {
            const writerWithTrace: Writer = {
                log: jest.fn(),
                info: jest.fn(),
                error: jest.fn(),
                trace: jest.fn(),
            };

            it('does not print with trace method if error is called', () => {
                const logger = new Logger(writerWithTrace);
                const message = 'some message';
                logger.currentLevel = LogLevel.Trace;
                logger.error(message);
                expect(writerWithTrace.error).toHaveBeenCalled();
                expect(writerWithTrace.trace).not.toHaveBeenCalled();
            });

            it('does not print with trace method if level is not enough', () => {
                const logger = new Logger(writerWithTrace);
                const message = 'some message';
                logger.currentLevel = LogLevel.Debug;

                logger.debug(message);
                expect(writerWithTrace.log).toHaveBeenCalled();

                logger.info(message);
                logger.warn(message);
                expect(writerWithTrace.info).toHaveBeenCalledTimes(2);

                expect(writerWithTrace.trace).not.toHaveBeenCalled();
            });

            it('print with regular methods if trace method is not provided and level is enough', () => {
                const logger = new Logger(writer);
                const message = 'some message';
                logger.currentLevel = LogLevel.Trace;

                logger.debug(message);
                expect(writer.log).toHaveBeenCalled();

                logger.info(message);
                logger.warn(message);
                expect(writer.info).toHaveBeenCalledTimes(2);
            });

            it('print with trace method', () => {
                const logger = new Logger(writerWithTrace);
                const message = 'some message';
                logger.currentLevel = LogLevel.Trace;

                logger.debug(message);
                logger.info(message);
                logger.warn(message);
                logger.error(message);

                expect(writerWithTrace.trace).toHaveBeenCalledTimes(3);
                expect(writerWithTrace.error).toHaveBeenCalled();
            });
        });
    });
});
