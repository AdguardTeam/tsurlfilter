import { FlexibleLoggerInterface } from '../../../../src/lib/common';

/**
 * Logger mock.
 */
export class MockLogger implements FlexibleLoggerInterface {
    setVerbose = jest.fn();

    error = jest.fn();

    warn = jest.fn();

    debug = jest.fn();

    info = jest.fn();
}
