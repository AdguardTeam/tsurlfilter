import { vi } from 'vitest';
import { type ILogger } from '../../src';

export class LoggerMock implements ILogger {
    public error = vi.fn();

    public warn = vi.fn();

    public debug = vi.fn();

    public info = vi.fn();
}
