import type { Writer } from '@adguard/logger/dist/types/Logger';

/**
 * Log writer mock.
 */
export class LogWriterMock implements Writer {
    log = jest.fn();

    info = jest.fn();

    error = jest.fn();
}
