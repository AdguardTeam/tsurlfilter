import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { logger } from '../../../../src/lib/common/utils/logger';
import { appContext } from '../../../../src/lib/mv3/background/app-context';
import { UserScriptsApi } from '../../../../src/lib/mv3/background/user-scripts-api';

describe('UserScriptsApi.executeExtCss', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // The default `global.chrome` (sinon-chrome) has no `userScripts`;
        // set up the mock used by the userScripts execution path.
        global.chrome = {
            ...global.chrome,
            userScripts: {
                execute: vi.fn(),
            } as any,
        };
        // `wrapScriptCode` keys the dedup guard on the start time; provide a
        // stable value so the test does not depend on persistent storage init.
        vi.spyOn(appContext, 'startTimeMs', 'get').mockReturnValue(123456);
    });

    it('calls chrome.userScripts.execute with USER_SCRIPT world, injectImmediately, and frameIds', async () => {
        const rules = ['div:has(.ad) { display: none !important; }'];

        await UserScriptsApi.executeExtCss({
            tabId: 1,
            frameId: 0,
            cssRules: rules,
            collectStats: false,
        });

        expect(chrome.userScripts.execute).toHaveBeenCalledTimes(1);
        const call = (chrome.userScripts.execute as any).mock.calls[0][0];
        expect(call.target).toEqual({ tabId: 1, frameIds: [0] });
        expect(call.injectImmediately).toBe(true);
        expect(call.world).toBe('USER_SCRIPT');
        expect(call.js).toHaveLength(1);
        expect(typeof call.js[0].code).toBe('string');
    });

    it('embeds the serialized applyExtCss and the rule arguments in the code string', async () => {
        const rules = ['a:has(b) { display: none !important; }'];

        await UserScriptsApi.executeExtCss({
            tabId: 2,
            frameId: 3,
            cssRules: rules,
            collectStats: true,
        });

        const code = (chrome.userScripts.execute as any).mock.calls[0][0].js[0].code as string;
        // The wrapped code contains the serialized applyExtCss body (the
        // inlined engine is minified to `applyExtendedCss`) and the serialized
        // rule array.
        expect(code).toContain('applyExtendedCss');
        expect(code).toContain('"a:has(b) { display: none !important; }"');
        expect(code).toContain('true');
    });

    it('logs userScripts.execute failures at debug level with no retry', async () => {
        const injectionError = new Error('no permission');
        (chrome.userScripts.execute as any).mockRejectedValue(injectionError);
        const debugSpy = vi.spyOn(logger, 'debug');

        // Must not throw: executeExtCss catches internally and resolves.
        await expect(UserScriptsApi.executeExtCss({
            tabId: 1,
            frameId: 0,
            cssRules: ['div:has(.ad) { display: none !important; }'],
            collectStats: false,
        })).resolves.toBeUndefined();

        // Single attempt — no retry loop.
        expect(chrome.userScripts.execute).toHaveBeenCalledTimes(1);

        // Logged once at debug level with the context-tagged message and the error.
        const expectedMessage = '[tsweb.UserScriptsApi.executeExtCss]:'
            + ' failed to execute ExtCSS user script to tabId 1 and frameId 0 due to:';
        expect(debugSpy).toHaveBeenCalledTimes(1);
        expect(debugSpy).toHaveBeenCalledWith(
            expect.stringContaining(expectedMessage),
            injectionError,
        );
    });
});
