import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { regexValidatorExtension } from '../../../src/re2-regexp/regex-validator-extension';

const isRegexSupportedMock = vi.fn();
vi.stubGlobal('chrome', {
    declarativeNetRequest: {
        isRegexSupported: isRegexSupportedMock,
    },
    runtime: {
        lastError: null,
    },
});

describe('regexValidatorExtension', () => {
    const mockIsRegexSupportedResult = (result: chrome.declarativeNetRequest.IsRegexSupportedResult) => {
        isRegexSupportedMock.mockImplementationOnce(
            (
                _options: chrome.declarativeNetRequest.RegexOptions,
                callback: (result: chrome.declarativeNetRequest.IsRegexSupportedResult) => void,
            ) => {
                callback(result);
            },
        );
    };

    it('should work properly', async () => {
        mockIsRegexSupportedResult({ isSupported: true });

        const result = regexValidatorExtension('test-regex');
        await expect(result).resolves.toBe(true);
    });

    it('should reject with an error if the regex is not supported', async () => {
        mockIsRegexSupportedResult({ isSupported: false, reason: 'syntaxError' as any });

        const result = regexValidatorExtension('test-regex');
        await expect(result).rejects.toThrow('syntaxError');
    });

    it('should reject with lastError if there is a runtime error', async () => {
        mockIsRegexSupportedResult({ isSupported: false });
        vi.spyOn(chrome.runtime, 'lastError', 'get').mockReturnValueOnce(new Error('Runtime error'));

        const result = regexValidatorExtension('test-regex');
        await expect(result).rejects.toThrow('Runtime error');
    });

    it('should reject if chrome.declarativeNetRequest is not available', async () => {
        vi.stubGlobal('chrome', { declarativeNetRequest: undefined });

        const result = regexValidatorExtension('test-regex');
        await expect(result).rejects.toThrow('chrome.declarativeNetRequest is not available');
    });
});
