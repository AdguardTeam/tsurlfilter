import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CosmeticApi } from '../../../../src/lib/mv3/background/cosmetic-api';
import { tabsApi } from '../../../../src/lib/mv3/tabs/tabs-api';

vi.mock('../../../../src/lib/mv3/tabs/tabs-api', () => ({
    tabsApi: {
        getFrameContext: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv3/background/app-context', () => ({
    appContext: {
        isStorageInitialized: true,
        isAppStarted: true,
        configuration: { settings: { debugScriptlets: false, collectStats: false } },
    },
}));

vi.mock('../../../../src/lib/mv3/background/engine-api', () => ({
    engineApi: {
        matchCosmetic: vi.fn(),
        isLocalFilter: vi.fn(),
        isUserRulesFilter: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv3/background/scripting-api', () => ({
    ScriptingApi: {
        executeScriptFunc: vi.fn(),
        executeScriptlet: vi.fn(),
        insertCSS: vi.fn(),
    },
}));

vi.mock('../../../../src/lib/mv3/background/services/local-script-rules-service', () => ({
    localScriptRulesService: {
        isLocalScript: vi.fn().mockReturnValue(false),
        getLocalScriptFunction: vi.fn().mockReturnValue(undefined),
    },
}));

vi.mock('../../../../src/lib/mv3/background/user-scripts-api', () => ({
    UserScriptsApi: {
        isEnabled: false,
        executeScripts: vi.fn(),
    },
}));

/**
 * Builds a minimal frame context for testing {@link CosmeticApi.applyCosmeticRules}.
 *
 * @param url Frame URL.
 *
 * @returns Partial frame context accepted by the mock.
 */
const makeFrameContext = (url: string): object => ({
    url,
    preparedCosmeticResult: {
        localRules: {
            scriptTexts: ['console.log("local")'],
            scriptletDataList: [{}],
            rawRules: [],
        },
        remoteRules: {
            scriptText: 'console.log("remote")',
            rawRules: [],
        },
        cssText: '.ad { display: none }',
    },
});

describe('CosmeticApi — preregistered script domains', () => {
    beforeEach(() => {
        // Reset to an empty set before every test.
        CosmeticApi.setPreregisteredScriptDomains([]);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('setPreregisteredScriptDomains / applyCosmeticRules', () => {
        it('skips local rules for an exact preregistered domain match', async () => {
            CosmeticApi.setPreregisteredScriptDomains(['youtube.com']);
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://youtube.com/watch?v=123') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');
            const applyRemote = vi.spyOn(CosmeticApi as any, 'applyRemoteCosmeticRules');

            await CosmeticApi.applyCosmeticRules(1, 0, false);

            expect(applyLocal).not.toHaveBeenCalled();
            expect(applyRemote).toHaveBeenCalled();
        });

        it('skips local rules when preregistered domain uses www and frame url is www', async () => {
            CosmeticApi.setPreregisteredScriptDomains(['www.youtube.com']);
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://www.youtube.com/watch?v=123') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules(1, 0, false);

            expect(applyLocal).not.toHaveBeenCalled();
        });

        it('skips local rules for a subdomain of a preregistered domain', async () => {
            CosmeticApi.setPreregisteredScriptDomains(['youtube.com']);
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://music.youtube.com/') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules(1, 0, false);

            expect(applyLocal).not.toHaveBeenCalled();
        });

        it('does NOT skip local rules for an unrelated domain', async () => {
            CosmeticApi.setPreregisteredScriptDomains(['youtube.com']);
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://google.com/') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules(1, 0, false);

            expect(applyLocal).toHaveBeenCalled();
        });

        // eslint-disable-next-line max-len
        it('does NOT skip local rules when the domain only ends with the registered name (not a subdomain)', async () => {
            // "notyoutube.com" ends with "youtube.com" but is not a subdomain
            CosmeticApi.setPreregisteredScriptDomains(['youtube.com']);
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://notyoutube.com/') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules(1, 0, false);

            expect(applyLocal).toHaveBeenCalled();
        });

        it('does NOT skip local rules when preregistered domains list is empty', async () => {
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://youtube.com/') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules(1, 0, false);

            expect(applyLocal).toHaveBeenCalled();
        });

        it('applies local rules when getDomain() returns null (e.g. about:blank)', async () => {
            CosmeticApi.setPreregisteredScriptDomains(['example.com']);
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('about:blank') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules(1, 0, false);

            expect(applyLocal).toHaveBeenCalled();
        });

        it('always applies remote rules regardless of preregistered domain match', async () => {
            CosmeticApi.setPreregisteredScriptDomains(['youtube.com']);
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://youtube.com/') as any,
            );

            const applyRemote = vi.spyOn(CosmeticApi as any, 'applyRemoteCosmeticRules');

            await CosmeticApi.applyCosmeticRules(1, 0, false);

            expect(applyRemote).toHaveBeenCalled();
        });

        it('returns early with empty array when frameContext is missing', async () => {
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(undefined);

            const result = await CosmeticApi.applyCosmeticRules(1, 0, false);

            expect(result).toEqual([]);
        });

        it('forceDynamicInjection bypasses suppression for an otherwise-preregistered domain', async () => {
            CosmeticApi.setPreregisteredScriptDomains(['youtube.com']);
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://youtube.com/') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules(1, 0, false, true);

            expect(applyLocal).toHaveBeenCalled();
        });

        it('replaces the entire domain set on subsequent calls', async () => {
            CosmeticApi.setPreregisteredScriptDomains(['youtube.com']);
            CosmeticApi.setPreregisteredScriptDomains(['example.com']);

            // youtube.com should now be un-preregistered
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://youtube.com/') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules(1, 0, false);

            expect(applyLocal).toHaveBeenCalled();
        });
    });
});
