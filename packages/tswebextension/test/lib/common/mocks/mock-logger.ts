import { type LoggerInterface } from '../../../../src/lib/common';

/**
 * Logger mock.
 */
export class MockLogger implements LoggerInterface {
    setVerbose = jest.fn();

    error = jest.fn();

    warn = jest.fn();

    debug = jest.fn();

    info = jest.fn();
}
