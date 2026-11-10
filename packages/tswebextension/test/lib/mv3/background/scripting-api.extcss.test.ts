import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { EXTCSS_PROTOCOL } from '../../../../src/lib/common/extcss-protocol';
import { ScriptingApi } from '../../../../src/lib/mv3/background/scripting-api';

const SCRIPT_URL = 'extcss-inject.js';

describe('ScriptingApi.executeExtCss', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('injects the engine asset first and the rules second, in the ISOLATED world', async () => {
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
});

describe('ScriptingApi.disposeExtCss', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('injects the disposal func in the ISOLATED world', async () => {
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
        await ScriptingApi.disposeExtCss({
            tabId: 1,
            frameId: 0,
            documentId: 'document-1',
        });

        expect(chrome.scripting.executeScript).toHaveBeenCalledWith(expect.objectContaining({
            target: { tabId: 1, documentIds: ['document-1'] },
        }));
    });
});
