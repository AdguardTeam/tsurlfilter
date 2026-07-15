import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { re2Validator } from '../../../src/re2-regexp/re2-validator';

vi.mock('../../../src/re2-regexp/regex-validator-extension', () => ({
    regexValidatorExtension: vi.fn(),
}));

describe('Re2Validator', () => {
    it('should work properly', async () => {
        const validatorFunction = vi.fn().mockResolvedValue(true);
        re2Validator.setValidator(validatorFunction);

        const result1 = await re2Validator.isRegexSupported('test-regex-1');
        expect(validatorFunction).toHaveBeenCalledTimes(1);
        expect(validatorFunction).toHaveBeenCalledWith('test-regex-1');
        expect(result1).toBe(true);

        validatorFunction.mockResolvedValueOnce(false);
        const result2 = await re2Validator.isRegexSupported('test-regex-2');
        expect(validatorFunction).toHaveBeenCalledTimes(2);
        expect(validatorFunction).toHaveBeenCalledWith('test-regex-2');
        expect(result2).toBe(false);
    });
});
