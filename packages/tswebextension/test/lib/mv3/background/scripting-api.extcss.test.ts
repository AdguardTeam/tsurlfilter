import {
    beforeEach,
    describe,
    expect,
    it,
    type Mock,
    vi,
} from 'vitest';

import { ExtCssGuardError } from '../../../../src/lib/common/extcss-guard-error';
import { EXTCSS_PROTOCOL } from '../../../../src/lib/common/extcss-protocol';
import { ScriptingApi } from '../../../../src/lib/mv3/background/scripting-api';

const SCRIPT_URL = 'extcss-inject.js';

/**
 * Returns the `executeScript` mock with a successful asset call and a given
 * apply call result.
 *
 * @param applyResults Result the apply call resolves with.
 *
 * @returns The mock.
 */
const mockInjection = (applyResults: unknown): Mock => {
    const executeScript = vi.mocked(chrome.scripting.executeScript) as unknown as Mock;

    return executeScript
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(applyResults);
};

/**
 * Parameters of a minimal ExtendedCss injection.
 */
const INJECTION_PARAMS = {
    tabId: 1,
    frameId: 0,
    cssRules: ['div:has(.ad) { display: none !important; }'],
    collectStats: false,
    scriptUrl: SCRIPT_URL,
};

describe('ScriptingApi.executeExtCss', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('injects the engine asset first and the rules second, in the ISOLATED world', async () => {
        mockInjection([{ result: true }]);

        await ScriptingApi.executeExtCss({
            tabId: 1,
            frameId: 0,
            cssRules: ['div:has(.ad) { display: none !important; }'],
            collectStats: false,
            scriptUrl: SCRIPT_URL,
        });

        expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
        expect(chrome.scripting.executeScript).toHaveBeenNthCalledWith(1, {
            target: { tabId: 1, frameIds: [0] },
            files: [SCRIPT_URL],
            injectImmediately: true,
            world: 'ISOLATED',
        });
        expect(chrome.scripting.executeScript).toHaveBeenNthCalledWith(2, {
            target: { tabId: 1, frameIds: [0] },
            func: expect.any(Function),
            args: [['div:has(.ad) { display: none !important; }'], false, EXTCSS_PROTOCOL],
            injectImmediately: true,
            world: 'ISOLATED',
        });
    });

    it('sends no engine source in the apply call', async () => {
        mockInjection([{ result: true }]);

        await ScriptingApi.executeExtCss({
            tabId: 1,
            frameId: 0,
            cssRules: ['div:has(.ad) { display: none !important; }'],
            collectStats: true,
            scriptUrl: SCRIPT_URL,
        });

        const applyCall = vi.mocked(chrome.scripting.executeScript).mock.calls[1][0] as {
            func?: () => void;
        };

        // `func` is serialized by the browser: it must carry the wiring only,
        // while the asset call above carries the engine.
        expect(String(applyCall.func)).not.toContain('class ExtendedCss');
    });

    it('binds both injections to the document when its id is known', async () => {
        mockInjection([{ result: true }]);

        await ScriptingApi.executeExtCss({
            tabId: 1,
            frameId: 0,
            documentId: 'document-1',
            cssRules: ['div:has(.ad) { display: none !important; }'],
            collectStats: false,
            scriptUrl: SCRIPT_URL,
        });

        expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
        expect(chrome.scripting.executeScript).toHaveBeenNthCalledWith(1, expect.objectContaining({
            target: { tabId: 1, documentIds: ['document-1'] },
        }));
        expect(chrome.scripting.executeScript).toHaveBeenNthCalledWith(2, expect.objectContaining({
            target: { tabId: 1, documentIds: ['document-1'] },
        }));
    });

    it('does not apply the rules when the engine asset cannot be injected', async () => {
        vi.mocked(chrome.scripting.executeScript).mockRejectedValueOnce(new Error('Cannot load script'));

        await expect(ScriptingApi.executeExtCss({
            tabId: 1,
            frameId: 0,
            cssRules: ['div:has(.ad) { display: none !important; }'],
            collectStats: false,
            scriptUrl: 'missing-extcss.js',
        })).rejects.toThrow('Cannot load script');

        expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
    });

    it('resolves when the apply call returns the success sentinel', async () => {
        mockInjection([{ result: true }]);

        await expect(ScriptingApi.executeExtCss(INJECTION_PARAMS)).resolves.toBeUndefined();
    });

    it.each([
        { name: 'a missing result array', applyResults: undefined },
        { name: 'an empty result array', applyResults: [] },
        { name: 'a missing result property', applyResults: [{}] },
        { name: 'a null result', applyResults: [{ result: null }] },
        { name: 'an undefined result', applyResults: [{ result: undefined }] },
        { name: 'a non-boolean result', applyResults: [{ result: 'ok' }] },
    ])('treats $name as a failed apply', async ({ applyResults }) => {
        mockInjection(applyResults);

        const injection = ScriptingApi.executeExtCss(INJECTION_PARAMS);

        // Chromium reports `null` both for an in-page exception and for a
        // `null`/`undefined` return, so only the sentinel proves success.
        await expect(injection).rejects.toThrow('did not report success');
        await expect(injection).rejects.not.toBeInstanceOf(ExtCssGuardError);
    });

    it.each([
        {
            name: 'missing engine',
            error: 'engine-not-loaded',
            message: 'ExtendedCss engine is not loaded',
        },
        {
            name: 'engine version mismatch',
            error: 'engine-version-mismatch',
            message: 'ExtendedCss engine version mismatch',
        },
    ])('throws when Chromium resolves the apply call with a $name failure', async ({ error, message }) => {
        mockInjection([{ result: { error, message } }]);

        const injection = ScriptingApi.executeExtCss({
            tabId: 1,
            frameId: 0,
            cssRules: ['div:has(.ad) { display: none !important; }'],
            collectStats: false,
            scriptUrl: SCRIPT_URL,
        });

        // The caller tells a terminal engine guard failure from a transient
        // injection error by the error type.
        await expect(injection).rejects.toThrow(message);
        await expect(injection).rejects.toBeInstanceOf(ExtCssGuardError);
    });
});

describe('ScriptingApi.insertCSS', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('falls back to the frame target without a document id', async () => {
        await ScriptingApi.insertCSS({ tabId: 1, frameId: 0, cssText: 'div { display: none !important; }' });

        expect(chrome.scripting.insertCSS).toHaveBeenCalledTimes(1);
        expect(chrome.scripting.insertCSS).toHaveBeenCalledWith({
            css: 'div { display: none !important; }',
            origin: 'USER',
            target: { tabId: 1, frameIds: [0] },
        });
    });

    it('binds the injection to the document when its id is known', async () => {
        await ScriptingApi.insertCSS({
            tabId: 1,
            frameId: 0,
            documentId: 'document-1',
            cssText: 'div { display: none !important; }',
        });

        expect(chrome.scripting.insertCSS).toHaveBeenCalledWith(expect.objectContaining({
            target: { tabId: 1, documentIds: ['document-1'] },
        }));
    });
});

/**
 * Returns the `executeScript` mock that resolves with the given disposal
 * result.
 *
 * @param disposeResults Result the disposal call resolves with.
 *
 * @returns The mock.
 */
const mockDisposal = (disposeResults: unknown): Mock => {
    const executeScript = vi.mocked(chrome.scripting.executeScript) as unknown as Mock;

    return executeScript.mockResolvedValueOnce(disposeResults);
};

describe('ScriptingApi.disposeExtCss', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('injects the disposal func in the ISOLATED world', async () => {
        mockDisposal([{ result: true }]);

        await ScriptingApi.disposeExtCss({ tabId: 1, frameId: 0 });

        expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
        expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
            target: { tabId: 1, frameIds: [0] },
            func: expect.any(Function),
            args: [EXTCSS_PROTOCOL],
            injectImmediately: true,
            world: 'ISOLATED',
        });
    });

    it('binds the disposal to the document when its id is known', async () => {
        mockDisposal([{ result: true }]);

        await ScriptingApi.disposeExtCss({
            tabId: 1,
            frameId: 0,
            documentId: 'document-1',
        });

        expect(chrome.scripting.executeScript).toHaveBeenCalledWith(expect.objectContaining({
            target: { tabId: 1, documentIds: ['document-1'] },
        }));
    });

    it.each([
        { name: 'a missing result array', disposeResults: undefined },
        { name: 'an empty result array', disposeResults: [] },
        { name: 'a null result', disposeResults: [{ result: null }] },
        { name: 'an undefined result', disposeResults: [{ result: undefined }] },
    ])('treats $name as a failed disposal', async ({ disposeResults }) => {
        mockDisposal(disposeResults);

        // The in-page disposal threw, which Chromium reports as a null result.
        // The old instance stays active, so it must not be recorded as
        // disposed.
        await expect(ScriptingApi.disposeExtCss({ tabId: 1, frameId: 0 }))
            .rejects.toThrow('did not report success');
    });
});
