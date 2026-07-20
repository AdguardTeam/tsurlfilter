import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { EXTCSS_PROTOCOL } from '../../../../src/lib/common/message-constants';
import { disposeExtCss } from '../../../../src/lib/mv3/background/extcss-apply-fn';
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
});

describe('ScriptingApi.disposeExtCss', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls executeScript with the dispose func, protocol arg, ISOLATED world, injectImmediately', async () => {
        await ScriptingApi.disposeExtCss({ tabId: 1, frameId: 0 });

        expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
        expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
            target: { tabId: 1, frameIds: [0] },
            func: disposeExtCss,
            args: [EXTCSS_PROTOCOL],
            injectImmediately: true,
            world: 'ISOLATED',
        });
    });
});
