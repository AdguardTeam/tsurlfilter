import chrome from 'sinon-chrome';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    type MockInstance,
    vi,
} from 'vitest';

import { logger } from '../../../../src/lib/common/utils/logger';
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
 * @param pathModifier Optional mock `$path` modifier (only `pattern` is read).
 * @param pathModifier.pattern Raw `$path` pattern text.
 *
 * @returns Mock rule.
 */
const makeRawRule = (content: string, pathModifier?: { pattern: string }): object => ({
    isScriptlet: false,
    getContent: (): string => content,
    pathModifier,
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
    frameId: 0,
    parentFrameId: -1,
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

/**
 * Builds a resolver returning frame contexts by frame id.
 *
 * @param frames Frame descriptors: frame id, parent frame id and URL.
 *
 * @returns Resolver for `tabsApi.getFrameContext`.
 */
const makeFrameChain = (
    frames: Array<{ frameId: number; parentFrameId: number; url: string }>,
): ((frameId: number) => object) => {
    const byId = new Map(frames.map((frame) => [
        frame.frameId,
        { ...makeFrameContext(frame.url), ...frame },
    ]));

    return (frameId: number) => byId.get(frameId) as object;
};

/**
 * Runs {@link CosmeticApi.applyCosmeticRules} for the given coverage and
 * frame, returning spies on the local and remote application paths.
 *
 * @param coveredEntries Covered hostname → rule hashes entries.
 * @param frame Frame context returned by the tabs API mock, or a resolver
 * receiving the requested frame id.
 * @param frameId Frame id the rules are applied to.
 * @param preExistingDocument Whether to pass `preExistingDocument`.
 * @param hostnames Preregistered hostnames; defaults to the covered keys.
 *
 * @returns Spies on `applyLocalCosmeticRules` and `applyRemoteCosmeticRules`.
 */
const runCosmeticApply = async (
    coveredEntries: Array<[string, Set<string>]>,
    frame: object | ((frameId: number) => object),
    frameId = 0,
    preExistingDocument = false,
    hostnames: string[] = coveredEntries.map(([hostname]) => hostname),
): Promise<{ applyLocal: MockInstance; applyRemote: MockInstance }> => {
    appContext.preregisteredScriptRules = new Map(coveredEntries);
    appContext.preregisteredHostnames = new Set(hostnames);

    const frameMock = vi.mocked(tabsApi.getFrameContext);
    if (typeof frame === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        frameMock.mockImplementation((_tabId: number, id: number) => frame(id) as any);
    } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        frameMock.mockReturnValue(frame as any);
    }

    const applyLocal = vi.spyOn(CosmeticApi as any, 'applyLocalCosmeticRules');
    const applyRemote = vi.spyOn(CosmeticApi as any, 'applyRemoteCosmeticRules');

    await CosmeticApi.applyCosmeticRules({
        tabId: 1,
        frameId,
        shouldApplyCss: false,
        preExistingDocument,
    });

    return { applyLocal, applyRemote };
};

describe('CosmeticApi — preregistered script rules', () => {
    beforeEach(() => {
        // Reset to an empty map before every test.
        appContext.preregisteredScriptRules = new Map();
        appContext.preregisteredHostnames = new Set();
    });

    afterEach(() => {
        vi.clearAllMocks();
        delete (appContext as { preregisteredScriptRulesAtBoot?: unknown }).preregisteredScriptRulesAtBoot;
        delete (appContext as { preregisteredScriptRules?: unknown }).preregisteredScriptRules;
        delete (appContext as { preregisteredHostnames?: unknown }).preregisteredHostnames;
    });

    describe('preregistered coverage / applyCosmeticRules', () => {
        it('skips local rules for an exact preregistered domain match', async () => {
            const { applyLocal } = await runCosmeticApply(
                [['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]],
                makeFrameContext('https://youtube.com/watch?v=123'),
            );

            expect(applyLocal).not.toHaveBeenCalled();
        });

        it('keeps a failing-hash rule on the dynamic path and logs it once', async () => {
            // A scriptlet rule with no parseable data fails hashing
            // deterministically; across frames it must stay on the dynamic
            // path and be logged only once.
            const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
            const failingRule = { isScriptlet: true, getScriptletData: (): null => null };
            const coverage: Array<[string, Set<string>]> = [['youtube.com', new Set(['deadbeefdeadbeef'])]];

            await runCosmeticApply(coverage, makeFrameContext('https://youtube.com/watch?v=123', [failingRule]));
            const { applyLocal } = await runCosmeticApply(
                coverage,
                makeFrameContext('https://youtube.com/watch?v=123', [failingRule]),
            );

            // The rule was not skipped — the hash failure kept it dynamic.
            expect(applyLocal).toHaveBeenCalled();

            const hashFailureLogs = loggerErrorSpy.mock.calls.filter(
                ([message]) => String(message).includes('Failed to hash a rule'),
            );
            expect(hashFailureLogs).toHaveLength(1);
        });

        // eslint-disable-next-line max-len
        it('does NOT skip local rules for a userinfo URL whose authority host differs', async () => {
            // `getHost()` truncates the authority at the first colon and
            // would resolve `https://youtube.com:x@evil.com/` to
            // `youtube.com`; the engine and the WHATWG URL parser resolve
            // `evil.com`, so youtube.com's coverage must not apply here.
            const { applyLocal } = await runCosmeticApply(
                [['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]],
                makeFrameContext('https://youtube.com:x@evil.com/'),
            );

            expect(applyLocal).toHaveBeenCalled();
        });

        // eslint-disable-next-line max-len
        it('skips local rules for a userinfo URL whose authority host matches the coverage host', async () => {
            // The host after the userinfo is what the engine resolves.
            const { applyLocal } = await runCosmeticApply(
                [['evil.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]],
                makeFrameContext('https://youtube.com:x@evil.com/'),
            );

            expect(applyLocal).not.toHaveBeenCalled();
        });

        it('skips local rules for a mixed-case URL host (hosts are matched case-insensitively)', async () => {
            const { applyLocal } = await runCosmeticApply(
                [['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]],
                makeFrameContext('https://YouTube.COM/watch?v=123'),
            );

            expect(applyLocal).not.toHaveBeenCalled();
        });

        it('skips local rules when preregistered domain uses www and frame url is www', async () => {
            const { applyLocal } = await runCosmeticApply(
                [['www.youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]],
                makeFrameContext('https://www.youtube.com/watch?v=123'),
            );

            expect(applyLocal).not.toHaveBeenCalled();
        });

        it('does NOT skip local rules for a subdomain (subdomains are not preregistered)', async () => {
            const { applyLocal } = await runCosmeticApply(
                [['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]],
                makeFrameContext('https://music.youtube.com/'),
            );

            expect(applyLocal).toHaveBeenCalled();
        });

        // eslint-disable-next-line max-len
        it('does NOT skip local rules when the domain only ends with the registered name (not a subdomain)', async () => {
            // "notyoutube.com" ends with "youtube.com" but is not a subdomain
            const { applyLocal } = await runCosmeticApply(
                [['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]],
                makeFrameContext('https://notyoutube.com/'),
            );

            expect(applyLocal).toHaveBeenCalled();
        });

        it('applies local rules for a hostless frame URL with no HTTP(S) ancestor (about:blank)', async () => {
            const { applyLocal } = await runCosmeticApply(
                [['example.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]],
                makeFrameContext('about:blank'),
            );

            expect(applyLocal).toHaveBeenCalled();
        });

        it('skips local rules for an opaque frame whose parent is a preregistered host', async () => {
            const childFrame = { ...makeFrameContext('about:blank'), frameId: 1, parentFrameId: 0 };
            const parentFrame = { ...makeFrameContext('https://youtube.com/'), frameId: 0, parentFrameId: -1 };

            const { applyLocal } = await runCosmeticApply(
                [['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]],
                (frameId: number) => (frameId === 1 ? childFrame : parentFrame),
                1,
            );

            expect(applyLocal).not.toHaveBeenCalled();
        });

        it('skips local rules for a data: current frame whose parent is a preregistered host', async () => {
            // The content script matched the data: frame through its
            // creator/initiator origin; the background uses the nearest HTTP
            // ancestor as the coverage host.
            const childFrame = {
                ...makeFrameContext('data:text/html,<p>x</p>'),
                frameId: 1,
                parentFrameId: 0,
            };
            const parentFrame = { ...makeFrameContext('https://youtube.com/'), frameId: 0, parentFrameId: -1 };

            const { applyLocal } = await runCosmeticApply(
                [['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]],
                (frameId: number) => (frameId === 1 ? childFrame : parentFrame),
                1,
            );

            expect(applyLocal).not.toHaveBeenCalled();
        });

        it('skips local rules for a blob: current frame whose parent is a preregistered host', async () => {
            const childFrame = {
                ...makeFrameContext('blob:https://youtube.com/00000000-0000-0000-0000-000000000000'),
                frameId: 1,
                parentFrameId: 0,
            };
            const parentFrame = { ...makeFrameContext('https://youtube.com/'), frameId: 0, parentFrameId: -1 };

            const { applyLocal } = await runCosmeticApply(
                [['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]],
                (frameId: number) => (frameId === 1 ? childFrame : parentFrame),
                1,
            );

            expect(applyLocal).not.toHaveBeenCalled();
        });

        it('keeps $path-qualified rules on the dynamic path in an opaque frame', async () => {
            // The per-rule `$path` guard cannot evaluate the ancestor's URL
            // from an about:blank/srcdoc frame, so the preregistered file
            // never runs such rules there; the dynamic path (which copied
            // the ancestor's result) must still deliver them.
            const pathRule = makeRawRule(LOCAL_JS_RULE_CONTENT, { pattern: '/tv' });
            const childFrame = {
                ...makeFrameContext('about:blank', [pathRule]),
                frameId: 1,
                parentFrameId: 0,
            };
            const parentFrame = {
                ...makeFrameContext('https://youtube.com/tv', [pathRule]),
                frameId: 0,
                parentFrameId: -1,
            };

            const { applyLocal } = await runCosmeticApply(
                [['youtube.com', new Set([await hashRule(pathRule)])]],
                (frameId: number) => (frameId === 1 ? childFrame : parentFrame),
                1,
            );

            expect(applyLocal).toHaveBeenCalledTimes(1);
            const localRules = applyLocal.mock.calls[0][2] as { rawRules: object[] };
            expect(localRules.rawRules).toHaveLength(1);
            expect(localRules.rawRules[0]).toBe(pathRule);
        });

        describe('preregistered coverage', () => {
            beforeEach(() => {
                chrome.webNavigation.getAllFrames.reset();
            });

            /**
             * Runs the cosmetic apply for a frame chain and returns the
             * local-apply spy.
             *
             * @param frames Frame descriptors: frame id, parent frame id and URL.
             * @param frameId Frame id the rules are applied to.
             * @param hostnames Preregistered hostnames.
             *
             * @returns Spy on `applyLocalCosmeticRules`.
             */
            const runChain = async (
                frames: Array<{ frameId: number; parentFrameId: number; url: string }>,
                frameId: number,
                hostnames: string[] = ['youtube.com', 'www.youtube.com'],
            ): Promise<MockInstance> => {
                const { applyLocal } = await runCosmeticApply(
                    [['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]],
                    makeFrameChain(frames),
                    frameId,
                    false,
                    hostnames,
                );

                return applyLocal;
            };

            it('does NOT skip local rules when the frame is embedded into a foreign site', async () => {
                const applyLocal = await runChain([
                    { frameId: 1, parentFrameId: 0, url: 'https://youtube.com/embed/abc' },
                    { frameId: 0, parentFrameId: -1, url: 'https://example.com/' },
                ], 1);

                expect(applyLocal).toHaveBeenCalled();
            });

            it('skips local rules when the top-level site is a preregistered host', async () => {
                const applyLocal = await runChain([
                    { frameId: 1, parentFrameId: 0, url: 'https://youtube.com/embed/abc' },
                    { frameId: 0, parentFrameId: -1, url: 'https://www.youtube.com/watch?v=1' },
                ], 1);

                expect(applyLocal).not.toHaveBeenCalled();
            });

            it('skips local rules when a foreign frame sits between the frame and a preregistered top', async () => {
                // The filtering state is tab-level: an intermediate frame does
                // not change it, and the dynamic path does not consider it.
                const applyLocal = await runChain([
                    { frameId: 1, parentFrameId: 2, url: 'https://youtube.com/embed/abc' },
                    { frameId: 2, parentFrameId: 0, url: 'https://example.com/embed' },
                    { frameId: 0, parentFrameId: -1, url: 'https://youtube.com/watch?v=1' },
                ], 1);

                expect(applyLocal).not.toHaveBeenCalled();
            });

            it('does NOT skip local rules when an intermediate ancestor is unknown', async () => {
                // The frame storage is temporary and the live frame tree does
                // not know the parent either: the top-level frame cannot be
                // reached. Unsure resolves to "foreign".
                chrome.webNavigation.getAllFrames.resolves([
                    { frameId: 1, parentFrameId: 2, url: 'https://youtube.com/embed/abc' },
                ]);

                const applyLocal = await runChain([
                    { frameId: 1, parentFrameId: 2, url: 'https://youtube.com/embed/abc' },
                ], 1);

                expect(applyLocal).toHaveBeenCalled();
            });

            it('skips local rules when a pruned parent is resolved from the live frame tree', async () => {
                // Intermediate frame contexts are pruned a few seconds after
                // load; the live frame tree still knows the whole chain.
                chrome.webNavigation.getAllFrames.resolves([
                    { frameId: 1, parentFrameId: 0, url: 'https://youtube.com/embed/abc' },
                    { frameId: 0, parentFrameId: -1, url: 'https://youtube.com/watch?v=1' },
                ]);

                const applyLocal = await runChain(
                    [{ frameId: 1, parentFrameId: 0, url: 'https://youtube.com/embed/abc' }],
                    1,
                );

                expect(applyLocal).not.toHaveBeenCalled();
            });

            it('does NOT skip local rules when a pruned parent is missing from the live frame tree', async () => {
                chrome.webNavigation.getAllFrames.resolves([
                    { frameId: 1, parentFrameId: 0, url: 'https://youtube.com/embed/abc' },
                ]);

                const applyLocal = await runChain(
                    [{ frameId: 1, parentFrameId: 0, url: 'https://youtube.com/embed/abc' }],
                    1,
                );

                expect(applyLocal).toHaveBeenCalled();
            });

            it('skips local rules when an about:blank frame sits under a preregistered top', async () => {
                const applyLocal = await runChain([
                    { frameId: 1, parentFrameId: 2, url: 'https://youtube.com/embed/abc' },
                    { frameId: 2, parentFrameId: 0, url: 'about:blank' },
                    { frameId: 0, parentFrameId: -1, url: 'https://youtube.com/watch?v=1' },
                ], 1);

                expect(applyLocal).not.toHaveBeenCalled();
            });

            it('skips local rules when a data: frame sits under a preregistered top', async () => {
                const applyLocal = await runChain([
                    { frameId: 1, parentFrameId: 2, url: 'https://youtube.com/embed/abc' },
                    { frameId: 2, parentFrameId: 0, url: 'data:text/html,<iframe></iframe>' },
                    { frameId: 0, parentFrameId: -1, url: 'https://youtube.com/watch?v=1' },
                ], 1);

                expect(applyLocal).not.toHaveBeenCalled();
            });

            it('does NOT skip local rules when the top-level frame has an opaque origin', async () => {
                const applyLocal = await runChain([
                    { frameId: 1, parentFrameId: 0, url: 'https://youtube.com/embed/abc' },
                    { frameId: 0, parentFrameId: -1, url: 'data:text/html,<iframe></iframe>' },
                ], 1);

                expect(applyLocal).toHaveBeenCalled();
            });

            it('skips local rules when a blob: frame carries a preregistered origin', async () => {
                const applyLocal = await runChain([
                    { frameId: 1, parentFrameId: 2, url: 'https://youtube.com/embed/abc' },
                    // eslint-disable-next-line max-len
                    { frameId: 2, parentFrameId: 0, url: 'blob:https://youtube.com/00000000-0000-0000-0000-000000000000' },
                    { frameId: 0, parentFrameId: -1, url: 'https://youtube.com/watch?v=1' },
                ], 1);

                expect(applyLocal).not.toHaveBeenCalled();
            });

            it('skips local rules when a foreign-origin blob: frame sits under a preregistered top', async () => {
                const applyLocal = await runChain([
                    { frameId: 1, parentFrameId: 2, url: 'https://youtube.com/embed/abc' },
                    // eslint-disable-next-line max-len
                    { frameId: 2, parentFrameId: 0, url: 'blob:https://example.com/00000000-0000-0000-0000-000000000000' },
                    { frameId: 0, parentFrameId: -1, url: 'https://youtube.com/watch?v=1' },
                ], 1);

                expect(applyLocal).not.toHaveBeenCalled();
            });

            it('does NOT skip local rules when the preregistered hostnames are not published', async () => {
                const applyLocal = await runChain(
                    [{ frameId: 0, parentFrameId: -1, url: 'https://youtube.com/watch?v=1' }],
                    0,
                    [],
                );

                expect(applyLocal).toHaveBeenCalled();
            });
        });

        it('always applies remote rules regardless of preregistered domain match', async () => {
            const { applyRemote } = await runCosmeticApply(
                [['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])]],
                makeFrameContext('https://youtube.com/'),
            );

            expect(applyRemote).toHaveBeenCalled();
        });

        it('returns early with empty array when frameContext is missing', async () => {
            vi.mocked(tabsApi.getFrameContext).mockReturnValue(undefined);

            const result = await CosmeticApi.applyCosmeticRules({ tabId: 1, frameId: 0, shouldApplyCss: false });

            expect(result).toEqual([]);
        });

        it('preExistingDocument skips local rules fully covered by the boot registrations', async () => {
            const hash = await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT));
            appContext.preregisteredScriptRules = new Map([['youtube.com', new Set([hash])]]);
            appContext.preregisteredScriptRulesAtBoot = new Map([['youtube.com', new Set([hash])]]);
            appContext.preregisteredHostnames = new Set(['youtube.com']);
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
            appContext.preregisteredScriptRules = new Map([['youtube.com', new Set([bootHash, addedHash])]]);
            // The boot snapshot only proves the first rule executed.
            appContext.preregisteredScriptRulesAtBoot = new Map([['youtube.com', new Set([bootHash])]]);
            appContext.preregisteredHostnames = new Set(['youtube.com']);
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
            appContext.preregisteredScriptRules = new Map([
                ['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])],
            ]);
            appContext.preregisteredScriptRulesAtBoot = new Map();
            appContext.preregisteredHostnames = new Set(['youtube.com']);
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
            appContext.preregisteredScriptRules = new Map([
                ['youtube.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])],
            ]);
            appContext.preregisteredScriptRules = new Map([
                ['example.com', new Set([await hashRule(makeRawRule(LOCAL_JS_RULE_CONTENT))])],
            ]);
            appContext.preregisteredHostnames = new Set(['example.com']);

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
            appContext.preregisteredScriptRules = new Map([['youtube.com', new Set([await hashRule(coveredRule)])]]);
            appContext.preregisteredHostnames = new Set(['youtube.com']);
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
            appContext.preregisteredScriptRules = new Map([
                ['youtube.com', new Set([await hashRule(makeRawRule(OTHER_JS_RULE_CONTENT))])],
            ]);
            appContext.preregisteredHostnames = new Set(['youtube.com']);
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
