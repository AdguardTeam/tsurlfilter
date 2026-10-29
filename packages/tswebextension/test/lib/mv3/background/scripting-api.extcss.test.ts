import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { EXTCSS_PROTOCOL } from '../../../../src/lib/mv3/background/extcss-protocol';
import { ScriptingApi } from '../../../../src/lib/mv3/background/scripting-api';

describe('ScriptingApi.executeExtCss', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls executeScript with ExtCSS func, rules, ISOLATED world, injectImmediately', async () => {
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

    it('passes the cssRules array as the first args entry', async () => {
        const rules = [
            'a:has(b) { display: none !important; }',
            'c:contains(d) { display: none !important; }',
        ];

        await ScriptingApi.executeExtCss({
            tabId: 2,
            frameId: 3,
            cssRules: rules,
            collectStats: false,
        });

        const call = vi.mocked(chrome.scripting.executeScript).mock.calls[0][0] as {
            args: unknown[];
        };
        expect(call.args).toEqual([rules, false, EXTCSS_PROTOCOL]);
    });

    it('passes collectStats as the second args entry', async () => {
        await ScriptingApi.executeExtCss({
            tabId: 1,
            frameId: 0,
            cssRules: ['div:has(.ad) { display: none !important; }'],
            collectStats: true,
        });

        const call = vi.mocked(chrome.scripting.executeScript).mock.calls[0][0] as {
            args: unknown[];
        };
        expect(call.args).toEqual([
            ['div:has(.ad) { display: none !important; }'],
            true,
            EXTCSS_PROTOCOL,
        ]);
    });

    it('passes the shared EXTCSS_PROTOCOL constant as the third args entry', async () => {
        await ScriptingApi.executeExtCss({
            tabId: 1,
            frameId: 0,
            cssRules: ['div:has(.ad) { display: none !important; }'],
            collectStats: false,
        });

        const call = vi.mocked(chrome.scripting.executeScript).mock.calls[0][0] as {
            args: unknown[];
        };
        // The protocol values must be the SHARED constant (single source of
        // truth), not a re-created object literal.
        expect(call.args[2]).toBe(EXTCSS_PROTOCOL);
        expect(call.args[2]).toEqual({
            markerPrefix: 'adguard',
            handlerName: 'tsWebExtension',
            messageType: 'saveCssHitsStats',
            instanceKey: '__adguardExtCss',
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
