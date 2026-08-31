import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { appContext } from '../../../../src/lib/mv3/background/app-context';
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
const makeFrameContext = (
    url: string,
    rawRules: object[] = [makeRawRule(LOCAL_JS_RULE_CONTENT)],
): object => ({
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
        delete (appContext as { preregisteredScriptRulesAtBoot?: unknown }).preregisteredScriptRulesAtBoot;
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

        it('applies local rules for a hostless frame URL with no HTTP(S) ancestor (about:blank)', async () => {
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

        it('skips local rules for an opaque frame whose parent is a preregistered host', async () => {
            CosmeticApi.setPreregisteredScriptRules(
                new Map([['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]]),
            );
            const childFrame = { ...makeFrameContext('about:blank'), frameId: 1, parentFrameId: 0 };
            const parentFrame = { ...makeFrameContext('https://youtube.com/'), frameId: 0, parentFrameId: -1 };
            vi.mocked(tabsApi.getFrameContext).mockImplementation(
                ((tabId: number, frameId: number) => (frameId === 1 ? childFrame : parentFrame)) as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules({ tabId: 1, frameId: 1, shouldApplyCss: false });

            expect(applyLocal).not.toHaveBeenCalled();
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

        it('preExistingDocument skips local rules fully covered by the boot registrations', async () => {
            const hash = await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT));
            CosmeticApi.setPreregisteredScriptRules(
                new Map([['youtube.com', new Set([hash])]]),
            );
            appContext.preregisteredScriptRulesAtBoot = new Map([['youtube.com', new Set([hash])]]);
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://youtube.com/') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules({
                tabId: 1,
                frameId: 0,
                shouldApplyCss: false,
                preExistingDocument: true,
            });

            expect(applyLocal).not.toHaveBeenCalled();
        });

        it('preExistingDocument still injects rules added to the registration after the page loaded', async () => {
            const bootHash = await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT));
            const addedHash = await hashRule(makeRawRule(OTHER_JS_RULE_CONTENT));
            CosmeticApi.setPreregisteredScriptRules(
                new Map([['youtube.com', new Set([bootHash, addedHash])]]),
            );
            // The boot snapshot only proves the first rule executed.
            appContext.preregisteredScriptRulesAtBoot = new Map([['youtube.com', new Set([bootHash])]]);
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext(
                    'https://youtube.com/',
                    [makeRawRule(LOCAL_JS_RULE_CONTENT), makeRawRule(OTHER_JS_RULE_CONTENT)],
                ) as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules({
                tabId: 1,
                frameId: 0,
                shouldApplyCss: false,
                preExistingDocument: true,
            });

            expect(applyLocal).toHaveBeenCalled();
            const rulesArg = applyLocal.mock.calls[0][2] as { rawRules: { getContent: () => string }[] };
            expect(rulesArg.rawRules).toHaveLength(1);
            expect(rulesArg.rawRules[0].getContent()).toBe(OTHER_JS_RULE_CONTENT);
        });

        it('preExistingDocument injects everything when the host had no boot registration', async () => {
            CosmeticApi.setPreregisteredScriptRules(
                new Map([['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]]),
            );
            appContext.preregisteredScriptRulesAtBoot = new Map();
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(
                makeFrameContext('https://youtube.com/') as any,
            );

            const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');

            await CosmeticApi.applyCosmeticRules({
                tabId: 1,
                frameId: 0,
                shouldApplyCss: false,
                preExistingDocument: true,
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
