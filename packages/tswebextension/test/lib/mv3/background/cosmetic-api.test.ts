import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CosmeticApi } from '../../../../src/lib/mv3/background/cosmetic-api';
import { computeRuleHash } from '../../../../src/lib/mv3/background/preregistered-scripts/hasher';
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

const LOCAL_JS_RULE_CONTENT = 'console.log("local-rule")';
const OTHER_JS_RULE_CONTENT = 'console.log("other-rule")';

/**
 * Builds a mock JS injection rule carrying the given body.
 *
 * @param content JS rule body as returned by `CosmeticRule.getContent()`.
 *
 * @returns Mock rule.
 */
const makeRawRule = (content: string): object => ({
    isScriptlet: false,
    getContent: (): string => content,
});

/**
 * Hashes a mock rule the same way the cosmetic API does internally.
 *
 * @param rule Mock rule.
 *
 * @returns Rule hash.
 */
const hashRule = async (rule: object): Promise<string> => {
    return computeRuleHash(rule as any);
};

/**
 * Builds a minimal frame context for testing {@link CosmeticApi.applyCosmeticRules}.
 *
 * @param url Frame URL.
 * @param rawRules Raw local rules of the prepared cosmetic result.
 *
 * @returns Partial frame context accepted by the mock.
 */
const makeFrameContext = (url: string, rawRules: object[] = [makeRawRule(LOCAL_JS_RULE_CONTENT)]): object => ({
    url,
    preparedCosmeticResult: {
        localRules: {
            scriptTexts: ['console.log("local")'],
            scriptletDataList: [{}],
            rawRules,
        },
        remoteRules: {
            scriptText: 'console.log("remote")',
            rawRules: [],
        },
        cssText: '.ad { display: none }',
    },
});

describe('CosmeticApi — preregistered script rules', () => {
    beforeEach(() => {
        // Reset to an empty map before every test.
        CosmeticApi.setPreregisteredScriptRules(new Map());
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('setPreregisteredScriptRules / applyCosmeticRules', () => {
        it('skips local rules for an exact preregistered domain match', async () => {
            CosmeticApi.setPreregisteredScriptRules(
                new Map([['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]]),
            );
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://youtube.com/watch?v=123') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');
            const applyRemote = vi.spyOn(CosmeticApi as any, 'applyRemoteCosmeticRules');

            await CosmeticApi.applyCosmeticRules({ tabId: 1, frameId: 0, shouldApplyCss: false });

            expect(applyLocal).not.toHaveBeenCalled();
            expect(applyRemote).toHaveBeenCalled();
        });

        it('skips local rules for a mixed-case URL host (hosts are matched case-insensitively)', async () => {
            CosmeticApi.setPreregisteredScriptRules(
                new Map([['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]]),
            );
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://YouTube.COM/watch?v=123') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules({ tabId: 1, frameId: 0, shouldApplyCss: false });

            expect(applyLocal).not.toHaveBeenCalled();
        });

        it('skips local rules when preregistered domain uses www and frame url is www', async () => {
            CosmeticApi.setPreregisteredScriptRules(
                new Map([['www.youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]]),
            );
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://www.youtube.com/watch?v=123') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules({ tabId: 1, frameId: 0, shouldApplyCss: false });

            expect(applyLocal).not.toHaveBeenCalled();
        });

        it('does NOT skip local rules for a subdomain (subdomains are not preregistered)', async () => {
            CosmeticApi.setPreregisteredScriptRules(
                new Map([['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]]),
            );
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://music.youtube.com/') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules({ tabId: 1, frameId: 0, shouldApplyCss: false });

            expect(applyLocal).toHaveBeenCalled();
        });

        it('does NOT skip local rules for an unrelated domain', async () => {
            CosmeticApi.setPreregisteredScriptRules(
                new Map([['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]]),
            );
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://google.com/') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules({ tabId: 1, frameId: 0, shouldApplyCss: false });

            expect(applyLocal).toHaveBeenCalled();
        });

        // eslint-disable-next-line max-len
        it('does NOT skip local rules when the domain only ends with the registered name (not a subdomain)', async () => {
            // "notyoutube.com" ends with "youtube.com" but is not a subdomain
            CosmeticApi.setPreregisteredScriptRules(
                new Map([['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]]),
            );
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://notyoutube.com/') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules({ tabId: 1, frameId: 0, shouldApplyCss: false });

            expect(applyLocal).toHaveBeenCalled();
        });

        it('does NOT skip local rules when preregistered rules map is empty', async () => {
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://youtube.com/') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules({ tabId: 1, frameId: 0, shouldApplyCss: false });

            expect(applyLocal).toHaveBeenCalled();
        });

        it('applies local rules when getDomain() returns null (e.g. about:blank)', async () => {
            CosmeticApi.setPreregisteredScriptRules(
                new Map([['example.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]]),
            );
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('about:blank') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules({ tabId: 1, frameId: 0, shouldApplyCss: false });

            expect(applyLocal).toHaveBeenCalled();
        });

        it('always applies remote rules regardless of preregistered domain match', async () => {
            CosmeticApi.setPreregisteredScriptRules(
                new Map([['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]]),
            );
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://youtube.com/') as any,
            );

            const applyRemote = vi.spyOn(CosmeticApi as any, 'applyRemoteCosmeticRules');

            await CosmeticApi.applyCosmeticRules({ tabId: 1, frameId: 0, shouldApplyCss: false });

            expect(applyRemote).toHaveBeenCalled();
        });

        it('returns early with empty array when frameContext is missing', async () => {
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(undefined);

            const result = await CosmeticApi.applyCosmeticRules({ tabId: 1, frameId: 0, shouldApplyCss: false });

            expect(result).toEqual([]);
        });

        it('forceDynamicInjection bypasses suppression for an otherwise-preregistered domain', async () => {
            CosmeticApi.setPreregisteredScriptRules(
                new Map([['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]]),
            );
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://youtube.com/') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules({
                tabId: 1,
                frameId: 0,
                shouldApplyCss: false,
                forceDynamicInjection: true,
            });

            expect(applyLocal).toHaveBeenCalled();
        });

        it('replaces the entire rules map on subsequent calls', async () => {
            CosmeticApi.setPreregisteredScriptRules(
                new Map([['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]]),
            );
            CosmeticApi.setPreregisteredScriptRules(
                new Map([['example.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]]),
            );

            // youtube.com should now be un-preregistered
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://youtube.com/') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules({ tabId: 1, frameId: 0, shouldApplyCss: false });

            expect(applyLocal).toHaveBeenCalled();
        });

        it('injects only the rules missing from the covered set', async () => {
            const coveredRule = makeRawRule(LOCAL_JS_RULE_CONTENT);
            const uncoveredRule = makeRawRule(OTHER_JS_RULE_CONTENT);
            CosmeticApi.setPreregisteredScriptRules(
                new Map([['youtube.com', new Set([await hashRule(coveredRule)])]]),
            );
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext(
                    'https://youtube.com/',
                    [coveredRule, uncoveredRule],
                ) as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules({ tabId: 1, frameId: 0, shouldApplyCss: false });

            expect(applyLocal).toHaveBeenCalledTimes(1);
            const localRules = applyLocal.mock.calls[0][2] as {
                rawRules: object[];
            };
            expect(localRules.rawRules).toHaveLength(1);
            expect(localRules.rawRules[0]).toBe(uncoveredRule);
        });

        it('injects all rules as-is when the covered set holds none of them', async () => {
            CosmeticApi.setPreregisteredScriptRules(
                new Map([['youtube.com', new Set([await hashRule(makeRawRule(OTHER_JS_RULE_CONTENT))])]]),
            );
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://youtube.com/') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules({ tabId: 1, frameId: 0, shouldApplyCss: false });

            expect(applyLocal).toHaveBeenCalledTimes(1);
            const localRules = applyLocal.mock.calls[0][2] as {
                rawRules: object[];
                scriptTexts: string[];
            };
            expect(localRules.rawRules).toHaveLength(1);
            expect(localRules.scriptTexts).toEqual(['console.log("local")']);
        });
    });
});
