import { ILogger } from '../../src/utils/logger';

export class LoggerMock implements ILogger {
    public error = jest.fn();

    public warn = jest.fn();

    public debug = jest.fn();

    public info = jest.fn();
}
