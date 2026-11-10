import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { EXTCSS_PROTOCOL } from '../../../../src/lib/common/extcss-protocol';
import { ScriptingApi } from '../../../../src/lib/mv3/background/scripting-api';

describe('ScriptingApi.executeExtCss', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls executeScript with ExtendedCss func, rules, ISOLATED world, injectImmediately', async () => {
        await ScriptingApi.executeExtCss({
            tabId: 1,
            frameId: 0,
            cssRules: ['div:has(.ad) { display: none !important; }'],
            collectStats: false,
        });

        expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
        expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
            target: { tabId: 1, frameIds: [0] },
            func: expect.any(Function),
            args: [['div:has(.ad) { display: none !important; }'], false, EXTCSS_PROTOCOL],
            injectImmediately: true,
            world: 'ISOLATED',
        });
    });

    it('binds the injection to the document when its id is known', async () => {
        await ScriptingApi.executeExtCss({
            tabId: 1,
            frameId: 0,
            documentId: 'document-1',
            cssRules: ['div:has(.ad) { display: none !important; }'],
            collectStats: false,
        });

        expect(chrome.scripting.executeScript).toHaveBeenCalledWith(expect.objectContaining({
            target: { tabId: 1, documentIds: ['document-1'] },
        }));
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
