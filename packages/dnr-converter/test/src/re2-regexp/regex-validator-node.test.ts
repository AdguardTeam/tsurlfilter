import * as RE2Module from '@adguard/re2-wasm';
import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { regexValidatorNode } from '../../../src/re2-regexp/regex-validator-node';

vi.mock('@adguard/re2-wasm', () => ({
    RE2: vi.fn(),
}));

describe('regexValidatorNode', () => {
    const RE2Spy = vi.spyOn(RE2Module, 'RE2');

    it('should work properly', async () => {
        const result = regexValidatorNode('test-regex');
        expect(RE2Spy).toHaveBeenCalledWith('test-regex', 'u', expect.any(Number));
        await expect(result).resolves.toBe(true);
    });

    it('should reject invalid regex', async () => {
        RE2Spy.mockImplementationOnce(() => {
            throw new Error('Invalid regex');
        });

        const result = regexValidatorNode('test-regex');
        expect(RE2Spy).toHaveBeenCalledWith('test-regex', 'u', expect.any(Number));
        await expect(result).rejects.toThrow('Invalid regex');
    });
});
