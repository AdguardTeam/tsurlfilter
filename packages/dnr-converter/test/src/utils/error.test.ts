import * as loggerModule from '@adguard/logger';
import * as valibotModule from 'valibot';
import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { getErrorMessage } from '../../../src/utils/error';
import * as valibotUtilsModule from '../../../src/utils/valibot';

vi.mock('valibot', () => ({
    ValiError: vi.fn(),
}));

vi.mock('../../../src/utils/valibot', () => ({
    extractMessageFromValiError: vi.fn((error: Error) => `ValiError: ${error.message}`),
}));

describe('Error utils', () => {
    describe('getErrorMessage', () => {
        const loggerGetErrorMessageSpy = vi.spyOn(loggerModule, 'getErrorMessage');
        const ValiErrorSpy = vi.spyOn(valibotModule, 'ValiError');
        const extractMessageFromValiErrorSpy = vi.spyOn(valibotUtilsModule, 'extractMessageFromValiError');

        it('should use logger getErrorMessage for non-ValiError errors', () => {
            const error = new Error('Test error');
            const message = getErrorMessage(error);
            expect(loggerGetErrorMessageSpy).toHaveBeenCalledTimes(1);
            expect(loggerGetErrorMessageSpy).toHaveBeenCalledWith(error);
            expect(message).toBe(error.message);
        });

        it('should use extractMessageFromValiError for ValiError errors', () => {
            // @ts-expect-error - Using ValiError mock
            const error = new ValiErrorSpy('Vali test error');
            const message = getErrorMessage(error);
            expect(extractMessageFromValiErrorSpy).toHaveBeenCalledTimes(1);
            expect(extractMessageFromValiErrorSpy).toHaveBeenCalledWith(error);
            expect(message).toBe(`ValiError: ${error.message}`);
        });
    });
});
