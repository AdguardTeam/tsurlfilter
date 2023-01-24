/* eslint-disable no-console */
import { Logger } from '../../../src/lib/common';

describe('logger', () => {
    const logger = new Logger();

    const callLoggerMethods = (): void => {
        logger.error('message');
        logger.warn('message');
        logger.debug('message');
        logger.info('message');
    };

    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(jest.fn);
        jest.spyOn(console, 'warn').mockImplementation(jest.fn);
        jest.spyOn(console, 'debug').mockImplementation(jest.fn);
        jest.spyOn(console, 'info').mockImplementation(jest.fn);
    });

    afterEach(() => jest.restoreAllMocks());

    it('does not call Logger methods when verbose is set to false', () => {
        callLoggerMethods();

        expect(console.warn).not.toHaveBeenCalled();
        expect(console.debug).not.toHaveBeenCalled();
        expect(console.info).not.toHaveBeenCalled();
        // logger.error should be called regardless of 'verbose'
        expect(console.error).toHaveBeenCalled();
    });

    it('calls Logger methods when verbose is set to true', () => {
        logger.setVerbose(true);
        callLoggerMethods();

        expect(console.warn).toHaveBeenCalled();
        expect(console.debug).toHaveBeenCalled();
        expect(console.info).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalled();
    });
});
