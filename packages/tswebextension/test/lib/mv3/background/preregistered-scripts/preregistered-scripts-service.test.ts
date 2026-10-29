import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CosmeticOption, CosmeticRule } from '@adguard/tsurlfilter';

import { appContext } from '../../../../../src/lib/mv3/background/app-context';
import {
    type ContentScriptDescriptor,
    ContentScriptManager,
} from '../../../../../src/lib/mv3/background/content-script-manager';
import { DocumentApi } from '../../../../../src/lib/mv3/background/document-api';
import { engineApi } from '../../../../../src/lib/mv3/background/engine-api';
import {
    CLEANUP_FILENAME,
    computeRuleHash,
    expandHostnames,
    getRuleFilename,
    MANIFEST_FILENAME,
    MANIFEST_SCHEMA_VERSION,
    SHARED_BUNDLE_FILENAME,
} from '../../../../../src/lib/mv3/background/preregistered-scripts/hasher';
import { clearManifestCache } from '../../../../../src/lib/mv3/background/preregistered-scripts/manifest-reader';
import {
    PreregisteredScriptsService,
} from '../../../../../src/lib/mv3/background/preregistered-scripts/preregistered-scripts-service';

vi.mock('../../../../../src/lib/mv3/background/engine-api', () => ({
    engineApi: {
        matchCosmetic: vi.fn(),
        isLocalFilter: vi.fn(),
        isCosmeticRuleAllowlisted: vi.fn().mockReturnValue(false),
    },
}));

vi.mock('../../../../../src/lib/mv3/background/document-api', () => ({
    DocumentApi: {
        matchFrame: vi.fn().mockReturnValue(null),
    },
}));

// Emulated browser registry state: the descriptors the last completed
// `sync` call registered, read back by `getRegistered`.
const registryState = vi.hoisted(() => ({
    descriptors: [] as ContentScriptDescriptor[],
}));

vi.mock('../../../../../src/lib/mv3/background/content-script-manager', () => ({
    ContentScriptManager: {
        sync: vi.fn().mockImplementation(async (
            _namespace: string,
            scripts: Array<{ id: string; js: string[] }>,
        ) => {
            registryState.descriptors = scripts;
            return { errors: [], failedScriptIds: [] };
        }),
        getRegistered: vi.fn().mockImplementation(async () => registryState.descriptors),
        clear: vi.fn().mockImplementation(async () => {
            registryState.descriptors = [];
        }),
    },
}));

const SCRIPTS_PATH = 'filters/preregistered-scripts';

/**
 * Builds a mock scriptlet rule as returned by `CosmeticResult.getScriptRules()`.
 *
 * @param name Scriptlet name.
 * @param args Scriptlet arguments.
 * @param filterListId Id of the filter list the rule came from.
 * @param pathModifier Optional mock `$path` modifier (only `pattern` is read).
 * @param pathModifier.pattern Raw `$path` pattern text.
 *
 * @returns Mock scriptlet rule.
 */
const mockScriptletRule = (
    name: string,
    args: string[],
    filterListId = 1,
    pathModifier?: { pattern: string },
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any => ({
    isScriptlet: true,
    getScriptletData: (): object => ({ params: { name, args } }),
    getFilterListId: (): number => filterListId,
    pathModifier,
});

/**
 * Builds a mock JS injection rule as returned by `CosmeticResult.getScriptRules()`.
 *
 * @param content Raw JS rule body.
 * @param filterListId Id of the filter list the rule came from.
 *
 * @returns Mock JS injection rule.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockJsRule = (content: string, filterListId = 1): any => ({
    isScriptlet: false,
    getContent: (): string => content,
    getFilterListId: (): number => filterListId,
});

/**
 * Configures `engineApi.matchCosmetic` to return the given rules (via
 * `getScriptRules()`) for the given domain, and `engineApi.isLocalFilter` to
 * treat `localFilterIds` as local filters (everything else is treated as
 * remote/custom/user rules).
 *
 * `disableJsForDomains` simulates a document-level allowlist rule (e.g.
 * `$document`/`$jsinject`) that suppresses JS injection for that domain —
 * `matchCosmetic` reports no script rules for it, same as the real engine
 * would once the JS cosmetic bit is cleared.
 *
 * @param rulesByDomain Map of domain → rules to return for that domain.
 * @param localFilterIds Filter ids considered "local" by `isLocalFilter`.
 * @param disableJsForDomains Domains for which `matchCosmetic` should report
 * no script rules (simulating an allowlist rule).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const setupEngine = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rulesByDomain: Record<string, any[]>,
    localFilterIds: number[] = [1],
    disableJsForDomains: string[] = [],
): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(engineApi.matchCosmetic).mockImplementation(({ requestUrl }: any) => {
        const domain = new URL(requestUrl as string).hostname;
        const rules = disableJsForDomains.includes(domain) ? [] : (rulesByDomain[domain] ?? []);
        return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            getScriptRules: (): any[] => rules as any[],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
    });
    vi.mocked(engineApi.isLocalFilter).mockImplementation(
        (filterListId: number) => localFilterIds.includes(filterListId),
    );
};

/**
 * Builds the fake per-function filename a test manifest maps a scriptlet
 * name to.
 *
 * @param name Scriptlet name.
 *
 * @returns Filename in the `s-{name}.js` shape the build-time tool emits.
 */
const scriptletFilename = (name: string): string => `s-${name}.js`;

/**
 * Stubs `chrome.runtime.getURL` and `fetch` so the manifest lookup behaves
 * as desired.
 *
 * @param hashes Manifest hash list to serve, or `null` to simulate a missing
 * (404) manifest.
 * @param scriptletFiles Scriptlet name → per-function filename map.
 * Defaults to an empty map.
 * @param hostnames Expanded host set to embed in the manifest. Defaults to
 * the configured domains; `null` omits the field to simulate a broken build.
 */
const setupManifest = (
    hashes: string[] | null,
    scriptletFiles?: Record<string, string>,
    hostnames: string[] | null = expandHostnames(['youtube.com']),
): void => {
    // sinon-chrome exposes getURL via a getter — replace the whole global.
    const getURL = vi.fn((p: string) => `chrome-extension://test/${p}`);
    vi.stubGlobal('chrome', {
        ...chrome,
        runtime: { ...chrome.runtime, getURL },
    });

    vi.stubGlobal('fetch', vi.fn(async () => {
        if (hashes === null) {
            return { ok: false, status: 404 };
        }
        return {
            ok: true,
            status: 200,
            json: async (): Promise<unknown> => ({
                schemaVersion: MANIFEST_SCHEMA_VERSION,
                hashes,
                scriptletFiles: scriptletFiles ?? {},
                ...(hostnames ? { hostnames } : {}),
            }),
        };
    }));
};

/**
 * Sets up the engine mock AND a manifest covering every hashable local rule
 * — the state a consistent build produces.
 *
 * @param rulesByDomain Map of domain → rules to return for that domain.
 * @param localFilterIds Filter ids considered "local" by `isLocalFilter`.
 * @param disableJsForDomains Domains for which `matchCosmetic` should report
 * no script rules (simulating an allowlist rule).
 */
const setupRulesWithManifest = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rulesByDomain: Record<string, any[]>,
    localFilterIds: number[] = [1],
    disableJsForDomains: string[] = [],
): Promise<void> => {
    setupEngine(rulesByDomain, localFilterIds, disableJsForDomains);

    const localRules = Object.values(rulesByDomain)
        .flat()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((rule: any) => localFilterIds.includes(rule.getFilterListId()));

    const hashResults = await Promise.all(localRules.map(async (rule) => {
        try {
            return await computeRuleHash(rule);
        } catch {
            return null;
        }
    }));

    // A consistent build maps every scriptlet name to its function file.
    const scriptletFiles: Record<string, string> = {};
    for (const rule of localRules) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const name = (rule as any).isScriptlet
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (rule as any).getScriptletData()?.params?.name
            : undefined;
        if (name) {
            scriptletFiles[name] = scriptletFilename(name);
        }
    }

    setupManifest(
        hashResults.filter((hash): hash is string => hash !== null),
        scriptletFiles,
    );
};

describe('PreregisteredScriptsService', () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        clearManifestCache();
        appContext.preregisteredScriptRulesAtBoot = undefined;
        appContext.preregisteredScriptRulesAtBootFailed = undefined;
        appContext.preregisteredScriptRules = undefined;
        appContext.preregisteredHostnames = undefined;
        appContext.preregisteredScripts = undefined;
        appContext.preregisteredScriptsKey = undefined;
        appContext.preregisteredScriptsRegistered = undefined;
        registryState.descriptors = [];
        // `clearAllMocks` clears calls but not implementations, so the
        // custom implementations and queued one-shot results of a test
        // would leak into the tests that run after it: restore the module
        // defaults here.
        vi.mocked(ContentScriptManager.sync).mockReset().mockImplementation(async (
            _namespace,
            scripts,
        ) => {
            registryState.descriptors = scripts;
            return { errors: [], failedScriptIds: [] };
        });
        vi.mocked(ContentScriptManager.getRegistered)
            .mockReset()
            .mockImplementation(async () => registryState.descriptors);
        vi.mocked(ContentScriptManager.clear).mockReset().mockImplementation(async () => {
            registryState.descriptors = [];
        });
        vi.mocked(DocumentApi.matchFrame).mockReset().mockReturnValue(null);
    });

    describe('sync — early exits', () => {
        it('syncs an empty script list and covers no domains when filtering is disabled', async () => {
            setupEngine({ 'youtube.com': [mockScriptletRule('foo', [])] });

            const result = await PreregisteredScriptsService.sync(false, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toEqual(new Map());
            expect(ContentScriptManager.sync).toHaveBeenCalledWith('preregistered', []);
        });

        it('syncs an empty script list and covers no domains when domains list is empty', async () => {
            const result = await PreregisteredScriptsService.sync(true, [], SCRIPTS_PATH);

            expect(result).toEqual(new Map());
            expect(ContentScriptManager.sync).toHaveBeenCalledWith('preregistered', []);
        });
    });

    describe('sync — building scripts', () => {
        it('registers a content script for a domain with a local scriptlet rule', async () => {
            const rule = mockScriptletRule('set-cookie', ['a', 'b']);
            await setupRulesWithManifest({ 'youtube.com': [rule] });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            const hash = await computeRuleHash(rule);
            expect(result.get('youtube.com')).toEqual(new Set([hash]));

            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts).toHaveLength(1);
            expect(scripts[0]).toMatchObject({
                id: 'youtube.com',
                matches: ['*://youtube.com/*'],
                runAt: 'document_start',
                world: 'MAIN',
                allFrames: true,
                matchOriginAsFallback: true,
                persistAcrossSessions: true,
            });
            expect(scripts[0].excludeMatches).toBeUndefined();
            // Shared bundle first, then the scriptlet function file,
            // per-hash files sorted, cleanup last (it deletes the
            // coordination property before page scripts run).
            expect(scripts[0].js).toEqual([
                `${SCRIPTS_PATH}/${SHARED_BUNDLE_FILENAME}`,
                `${SCRIPTS_PATH}/${scriptletFilename('set-cookie')}`,
                `${SCRIPTS_PATH}/${getRuleFilename(hash)}`,
                `${SCRIPTS_PATH}/${CLEANUP_FILENAME}`,
            ]);
        });

        it('does not treat prototype properties as scriptlet function files', async () => {
            // A manifest cannot have an own `__proto__` key in practice:
            // assigning it through a plain object literal sets the prototype.
            // The lookup must not resolve the inherited member and mark the
            // rule as covered with a file that cannot exist.
            const rule = mockScriptletRule('__proto__', []);
            await setupRulesWithManifest({ 'youtube.com': [rule] });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result.get('youtube.com')).toBeUndefined();
            expect(ContentScriptManager.sync).toHaveBeenCalledWith('preregistered', []);
        });

        it('registers a content script for a domain with a JS injection rule', async () => {
            const rule = mockJsRule('console.log(1)');
            await setupRulesWithManifest({ 'youtube.com': [rule] });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result.get('youtube.com'))
                .toEqual(new Set([await computeRuleHash(rule)]));
            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts).toHaveLength(1);
        });

        it('does not register a script for a domain with no matching rules', async () => {
            await setupRulesWithManifest({ 'youtube.com': [] });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toEqual(new Map());
            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts).toHaveLength(0);
        });

        it('skips preregistration for a domain covered by a document-level allowlist rule', async () => {
            await setupRulesWithManifest(
                { 'youtube.com': [mockScriptletRule('set-cookie', [])] },
                [1],
                ['youtube.com'],
            );

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toEqual(new Map());
            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts).toHaveLength(0);
        });

        it('queries DocumentApi.matchFrame() and forwards its result as frameRule (inverted allowlist)', async () => {
            await setupRulesWithManifest({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const syntheticAllowlistRule = { isAllowlist: (): boolean => true } as any;
            vi.mocked(DocumentApi.matchFrame).mockReturnValue(syntheticAllowlistRule);

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(DocumentApi.matchFrame).toHaveBeenCalledWith('https://youtube.com/');
            expect(engineApi.matchCosmetic).toHaveBeenCalledWith(
                expect.objectContaining({ frameRule: syntheticAllowlistRule }),
                {
                    // Only JS/scriptlet rules are preregistered — the
                    // cosmetic match is narrowed to them.
                    ignorePath: true,
                    optionMask: CosmeticOption.CosmeticOptionJS,
                },
            );
        });

        it('includes rules with a $path modifier (over-collected, path enforced later at runtime)', async () => {
            await setupRulesWithManifest({
                'youtube.com': [
                    mockScriptletRule('set-cookie', [], 1, { pattern: '/watch' }),
                ],
            });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts).toHaveLength(1);
            // Shared bundle + the scriptlet function file + the per-hash file + cleanup.
            expect(scripts[0].js).toHaveLength(4);
        });

        it('excludes $url-scoped rules even when their hash is in the manifest', async () => {
            // The build never generates a file for a `$url` rule, but even a
            // manifest that lists its hash must not register it: the generated
            // file has no URL guard, so the rule would over-apply on every
            // path of the host instead of its URL scope.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const urlRule = {
                isScriptlet: true,
                getScriptletData: (): object => ({ params: { name: 'set-cookie', args: ['a', 'b'] } }),
                getFilterListId: (): number => 1,
                urlModifier: { pattern: '|https://youtube.com/|' },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any;
            setupEngine({ 'youtube.com': [urlRule] });
            setupManifest(
                [await computeRuleHash(urlRule)],
                { 'set-cookie': scriptletFilename('set-cookie') },
            );

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toEqual(new Map());
            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts).toHaveLength(0);
        });

        it('treats a www. hostname as its own independent entry (no union with the apex)', async () => {
            await setupRulesWithManifest({
                'www.youtube.com': [mockScriptletRule('set-cookie', [])],
            });

            await PreregisteredScriptsService.sync(true, ['www.youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts).toHaveLength(1);
            expect(scripts[0].id).toBe('www.youtube.com');
            expect(scripts[0].matches).toEqual(['*://www.youtube.com/*']);
        });

        it('derives the www. alias from the apex domain and registers it when it has rules', async () => {
            await setupRulesWithManifest({
                'www.youtube.com': [mockScriptletRule('set-cookie', [])],
            });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts).toHaveLength(1);
            expect(scripts[0].id).toBe('www.youtube.com');
            expect(scripts[0].matches).toEqual(['*://www.youtube.com/*']);
        });

        it('skips the www. alias when it has no matching rules', async () => {
            await setupRulesWithManifest({
                'youtube.com': [mockScriptletRule('set-cookie', [])],
            });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts).toHaveLength(1);
            expect(scripts[0].id).toBe('youtube.com');
        });

        it('excludes rules from non-local (custom/user) filters from hashing', async () => {
            // Only rule on the domain comes from a non-local filter (e.g. a
            // custom filter or user rule) — must NOT produce a registration,
            // since no build-time per-hash file exists for it.
            await setupRulesWithManifest(
                { 'youtube.com': [mockScriptletRule('set-cookie', [], 99)] },
                [1], // only filter id 1 is local
            );

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts).toHaveLength(0);
        });

        it('includes only the local rule when local and non-local rules coexist on a domain', async () => {
            await setupRulesWithManifest(
                {
                    'youtube.com': [
                        mockScriptletRule('set-cookie', [], 1),
                        mockScriptletRule('set-cookie', ['x'], 99),
                    ],
                },
                [1],
            );

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts).toHaveLength(1);
            // Shared bundle + function file + one per-hash file (the local rule only) + cleanup.
            expect(scripts[0].js).toHaveLength(4);
        });

        it('keeps the domain registered when a single rule fails to hash', async () => {
            const badRule = {
                isScriptlet: true,
                getScriptletData: (): null => null,
                getFilterListId: (): number => 1,
            };
            const goodRule = mockScriptletRule('set-cookie', []);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await setupRulesWithManifest({ 'youtube.com': [badRule as any, goodRule] });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result.get('youtube.com'))
                .toEqual(new Set([await computeRuleHash(goodRule)]));
            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts[0].js).toHaveLength(4); // bundle + function file + the one valid rule + cleanup
        });
    });

    describe('sync — scriptlet function files', () => {
        it('keeps dynamic injection for a scriptlet rule with no function file in the manifest', async () => {
            const rule = mockScriptletRule('set-cookie', []);
            setupEngine({ 'youtube.com': [rule] });
            // Manifest has the rule hash but no function file for the name.
            setupManifest([await computeRuleHash(rule)], {});

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toEqual(new Map());
            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts).toHaveLength(0);
        });

        it('includes each function file once when several rules use the same scriptlet', async () => {
            await setupRulesWithManifest({
                'youtube.com': [
                    mockScriptletRule('set-cookie', ['a']),
                    mockScriptletRule('set-cookie', ['b']),
                ],
            });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            const js = scripts[0].js ?? [];
            expect(js.filter(
                (file) => file === `${SCRIPTS_PATH}/${scriptletFilename('set-cookie')}`,
            )).toHaveLength(1);
        });

        it('does not include function files of scriptlets the domain does not use', async () => {
            const rule = mockScriptletRule('set-cookie', []);
            setupEngine({ 'youtube.com': [rule] });
            setupManifest([await computeRuleHash(rule)], {
                'set-cookie': scriptletFilename('set-cookie'),
                'prevent-fetch': scriptletFilename('prevent-fetch'),
            });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts[0].js).not.toContain(`${SCRIPTS_PATH}/${scriptletFilename('prevent-fetch')}`);
        });
    });

    describe('sync — manifest required', () => {
        it('covers the domain when the manifest contains all computed hashes', async () => {
            const rule = mockScriptletRule('set-cookie', []);
            setupEngine({ 'youtube.com': [rule] });
            setupManifest(
                [await computeRuleHash(rule)],
                { 'set-cookie': scriptletFilename('set-cookie') },
            );

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect([...result.keys()]).toEqual(['youtube.com']);
            expect(chrome.runtime.getURL).toHaveBeenCalledWith(`${SCRIPTS_PATH}/${MANIFEST_FILENAME}`);
        });

        it('does not clear registrations when the manifest is missing (404)', async () => {
            setupEngine({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            setupManifest(null);

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            // A missing manifest is a broken build: the sync fails and the
            // registrations stay untouched.
            expect(ContentScriptManager.sync).not.toHaveBeenCalled();
            expect(result).toEqual(new Map());
        });

        it('keeps stale registrations when the manifest is missing', async () => {
            setupEngine({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            // A stale persistAcrossSessions registration from a previous version.
            registryState.descriptors = [
                { id: 'youtube.com', js: [`${SCRIPTS_PATH}/0123456789abcdef.js`] },
            ];
            setupManifest(null);

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            // A missing manifest is a broken build: the sync fails instead
            // of silently dropping the stale registration.
            expect(ContentScriptManager.sync).not.toHaveBeenCalled();
            expect(result).toEqual(new Map());
        });

        it('does not clear registrations when the manifest fetch fails', async () => {
            setupEngine({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            const getURL = vi.fn(() => {
                throw new Error('no chrome.runtime');
            });
            vi.stubGlobal('chrome', { ...chrome, runtime: { ...chrome.runtime, getURL } });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(ContentScriptManager.sync).not.toHaveBeenCalled();
            expect(result).toEqual(new Map());
        });

        it('degrades only the rule whose hash is missing from the manifest, keeping the rest covered', async () => {
            const keptRule = mockScriptletRule('set-cookie', []);
            const degradedRule = mockScriptletRule('prevent-fetch', []);
            setupEngine({ 'youtube.com': [keptRule, degradedRule] });
            setupManifest(
                [await computeRuleHash(keptRule)],
                { 'set-cookie': scriptletFilename('set-cookie') },
            );

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result.get('youtube.com'))
                .toEqual(new Set([await computeRuleHash(keptRule)]));
            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts[0].js).toHaveLength(4); // bundle + function file + the covered rule + cleanup
        });
    });

    describe('sync — runtime $path exceptions', () => {
        const blockedRuleText = "youtube.com#%#//scriptlet('set-cookie', 'a', 'b')";
        const keptRuleText = "youtube.com#%#//scriptlet('prevent-fetch')";

        afterEach(() => {
            vi.mocked(engineApi.isCosmeticRuleAllowlisted).mockReset().mockReturnValue(false);
        });

        it('degrades only the rule cancelled by a $path exception, keeping the rest covered', async () => {
            const blockedRule = new CosmeticRule(blockedRuleText, 1);
            const keptRule = new CosmeticRule(keptRuleText, 1);
            await setupRulesWithManifest({ 'youtube.com': [blockedRule, keptRule] });
            vi.mocked(engineApi.isCosmeticRuleAllowlisted).mockImplementation(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (_hostname: string, rule: any) => rule.getText() === blockedRuleText,
            );

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result.get('youtube.com')).toEqual(new Set([await computeRuleHash(keptRule)]));
            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts).toHaveLength(1);
            expect(scripts[0].js).toHaveLength(4); // bundle + function file + the covered rule + cleanup
        });

        it('asks the engine to ignore the exception URL conditions', async () => {
            const blockedRule = new CosmeticRule(blockedRuleText, 1);
            await setupRulesWithManifest({ 'youtube.com': [blockedRule] });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(engineApi.isCosmeticRuleAllowlisted)
                .toHaveBeenCalledWith('youtube.com', blockedRule, { ignoreExceptionUrlConditions: true });
        });

        it('does not register the domain when its only rule is cancelled by a $path exception', async () => {
            const blockedRule = new CosmeticRule(blockedRuleText, 1);
            await setupRulesWithManifest({ 'youtube.com': [blockedRule] });
            vi.mocked(engineApi.isCosmeticRuleAllowlisted).mockReturnValue(true);

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toEqual(new Map());
            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts).toHaveLength(0);
        });
    });

    describe('sync — failure propagation', () => {
        it('reports the coverage of the registrations actually active after a partially failed sync', async () => {
            const exampleRule = mockScriptletRule('set-cookie', []);
            await setupRulesWithManifest({
                'youtube.com': [mockScriptletRule('set-cookie', [])],
                'example.com': [exampleRule],
            });
            const rejection = {
                status: 'rejected',
                reason: new Error('registerContentScripts failed'),
            } as PromiseRejectedResult;
            vi.mocked(ContentScriptManager.sync).mockResolvedValueOnce({
                errors: [rejection],
                failedScriptIds: ['youtube.com'],
            });
            // The browser applied everything except the failed host.
            const hash = await computeRuleHash(exampleRule);
            vi.mocked(ContentScriptManager.getRegistered).mockResolvedValueOnce([
                { id: 'example.com', js: [`${SCRIPTS_PATH}/${getRuleFilename(hash)}`] },
            ]);

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com', 'example.com'], SCRIPTS_PATH);

            expect([...result.keys()]).toEqual(['example.com']);
            expect(result.get('example.com')).toEqual(new Set([hash]));
        });

        it('covers no domains (without throwing) when ContentScriptManager.sync throws', async () => {
            await setupRulesWithManifest({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            vi.mocked(ContentScriptManager.sync).mockRejectedValueOnce(new Error('invalid namespace'));

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toEqual(new Map());
        });

        it('falls back to the boot snapshot when the sync throws', async () => {
            await setupRulesWithManifest({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            vi.mocked(ContentScriptManager.sync).mockRejectedValueOnce(new Error('invalid namespace'));
            appContext.preregisteredScriptRulesAtBoot = new Map([
                ['youtube.com', new Set(['0123456789abcdef'])],
            ]);

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toEqual(new Map([['youtube.com', new Set(['0123456789abcdef'])]]));
        });

        it('reports the stale registration still active after a failed host update', async () => {
            const rule = mockScriptletRule('set-cookie', []);
            await setupRulesWithManifest({ 'youtube.com': [rule] });
            const staleHash = '0123456789abcdef';
            vi.mocked(ContentScriptManager.sync).mockResolvedValueOnce({
                errors: [{ status: 'rejected', reason: new Error('update failed') } as PromiseRejectedResult],
                failedScriptIds: ['youtube.com'],
            });
            // The browser keeps the stale registration for the failed host.
            vi.mocked(ContentScriptManager.getRegistered).mockResolvedValueOnce([
                { id: 'youtube.com', js: [`${SCRIPTS_PATH}/${getRuleFilename(staleHash)}`] },
            ]);

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            // The stale registration still runs at document_start, so its
            // rules must stay covered; the fresh hash is NOT covered and
            // goes through dynamic injection.
            expect(result.get('youtube.com')).toEqual(new Set([staleHash]));
        });

        it('uses the last successful coverage, not boot, when a later host update fails', async () => {
            const firstRule = mockScriptletRule('set-cookie', []);
            await setupRulesWithManifest({ 'youtube.com': [firstRule] });
            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            // The engine now returns a different rule for the host, and the
            // update for it fails.
            await setupRulesWithManifest({ 'youtube.com': [mockScriptletRule('prevent-fetch', [])] });
            vi.mocked(ContentScriptManager.sync).mockResolvedValueOnce({
                errors: [{ status: 'rejected', reason: new Error('update failed') } as PromiseRejectedResult],
                failedScriptIds: ['youtube.com'],
            });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            // The registration from the first sync is still the active one —
            // its hash stays covered, and the boot snapshot is NOT consulted.
            expect(result.get('youtube.com')).toEqual(new Set([await computeRuleHash(firstRule)]));
        });

        it('does not resurrect boot coverage for a host removed by an earlier successful sync', async () => {
            await setupRulesWithManifest({ 'youtube.com': [] });
            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            // Rules exist again, but the update fails — no registration is
            // active for the host, so nothing may be reported as covered.
            await setupRulesWithManifest({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            vi.mocked(ContentScriptManager.sync).mockResolvedValueOnce({
                errors: [{ status: 'rejected', reason: new Error('update failed') } as PromiseRejectedResult],
                failedScriptIds: ['youtube.com'],
            });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result.get('youtube.com')).toBeUndefined();
        });

        it('returns the last successful coverage when a later sync throws', async () => {
            const rule = mockScriptletRule('set-cookie', []);
            await setupRulesWithManifest({ 'youtube.com': [rule] });
            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            vi.mocked(ContentScriptManager.sync).mockRejectedValueOnce(new Error('invalid namespace'));

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            // The registrations from the first sync are still active.
            expect(result.get('youtube.com')).toEqual(new Set([await computeRuleHash(rule)]));
        });

        it('reports empty coverage (not last/boot) when the post-sync read fails', async () => {
            const rule = mockScriptletRule('set-cookie', []);
            await setupRulesWithManifest({ 'youtube.com': [rule] });
            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            // Disabling the feature changes the descriptor set, so the sync
            // runs; it fails partially and the read-back fails too. The
            // registrations were already replaced, so publishing
            // last-known coverage would suppress dynamic injection for
            // rules with no active registration — the service fails safe to
            // empty coverage.
            vi.mocked(ContentScriptManager.sync).mockResolvedValueOnce({
                errors: [{ status: 'rejected', reason: new Error('update failed') }],
                failedScriptIds: ['youtube.com'],
            });
            vi.mocked(ContentScriptManager.getRegistered).mockRejectedValueOnce(new Error('read failed'));

            const result = await PreregisteredScriptsService.sync(false, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toEqual(new Map());
        });

        it('does not resurrect stale or boot coverage when a later sync fails after a read failure', async () => {
            const rule = mockScriptletRule('set-cookie', []);
            await setupRulesWithManifest({ 'youtube.com': [rule] });
            appContext.preregisteredScriptRulesAtBoot = new Map([
                ['youtube.com', new Set(['0123456789abcdef'])],
            ]);

            // First sync succeeds and publishes its coverage.
            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            // Second sync (feature disabled — a different descriptor set)
            // replaces the registrations partially, and reading them back
            // fails: empty coverage is published.
            vi.mocked(ContentScriptManager.sync).mockResolvedValueOnce({
                errors: [{ status: 'rejected', reason: new Error('update failed') }],
                failedScriptIds: ['youtube.com'],
            });
            vi.mocked(ContentScriptManager.getRegistered).mockRejectedValueOnce(new Error('read failed'));
            await PreregisteredScriptsService.sync(false, ['youtube.com'], SCRIPTS_PATH);

            // Third sync fails: neither the pre-mutation coverage nor the
            // boot snapshot describes the active registrations anymore, so
            // neither may be republished.
            vi.mocked(ContentScriptManager.sync).mockRejectedValueOnce(new Error('invalid namespace'));
            const result = await PreregisteredScriptsService.sync(false, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toEqual(new Map());
            expect(appContext.preregisteredScriptRules).toEqual(new Map());
        });

        it('covers no domains (without throwing) when the engine fails', async () => {
            setupManifest([]);
            vi.mocked(engineApi.matchCosmetic).mockImplementation(() => {
                throw new Error('engine broken');
            });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toEqual(new Map());
        });
    });

    describe('sync — concurrency', () => {
        it('serializes concurrent sync calls', async () => {
            await setupRulesWithManifest({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });

            const order: string[] = [];
            vi.mocked(ContentScriptManager.sync).mockImplementation(async () => {
                order.push('start');
                await new Promise((resolve) => {
                    setTimeout(resolve, 10);
                });
                order.push('end');
                return { errors: [], failedScriptIds: [] };
            });

            await Promise.all([
                PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH),
                // A different domain with no rules builds an empty descriptor
                // set: unlike a repeated identical sync, it is not skipped.
                PreregisteredScriptsService.sync(true, ['example.com'], SCRIPTS_PATH),
            ]);

            // Second sync must not start before the first one finished.
            expect(order).toEqual(['start', 'end', 'start', 'end']);
        });
    });

    describe('sync — caching', () => {
        it('fetches the manifest once across syncs for the same path', async () => {
            await setupRulesWithManifest({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);
            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
        });

        it('skips the browser sync when the descriptor set is unchanged', async () => {
            const rule = mockScriptletRule('set-cookie', []);
            await setupRulesWithManifest({ 'youtube.com': [rule] });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);
            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(ContentScriptManager.sync).toHaveBeenCalledTimes(1);
            expect(result).toEqual(
                new Map([['youtube.com', new Set([await computeRuleHash(rule)])]]),
            );
        });

        it('syncs again after a stop even when the descriptor set is unchanged', async () => {
            await setupRulesWithManifest({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);
            await PreregisteredScriptsService.stop();
            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(ContentScriptManager.sync).toHaveBeenCalledTimes(2);
        });
    });

    describe('init', () => {
        it('syncs, snapshots the persisted registrations once, and reports the covered rules', async () => {
            const rule = mockScriptletRule('set-cookie', []);
            await setupRulesWithManifest({ 'youtube.com': [rule] });

            const hash = await computeRuleHash(rule);
            vi.mocked(ContentScriptManager.getRegistered).mockResolvedValue([
                {
                    id: 'youtube.com',
                    js: [
                        `${SCRIPTS_PATH}/${SHARED_BUNDLE_FILENAME}`,
                        `${SCRIPTS_PATH}/${scriptletFilename('set-cookie')}`,
                        `${SCRIPTS_PATH}/${getRuleFilename(hash)}`,
                        `${SCRIPTS_PATH}/${CLEANUP_FILENAME}`,
                    ],
                },
            ]);

            const config = { domains: ['youtube.com'], path: SCRIPTS_PATH };
            await PreregisteredScriptsService.init(true, config);
            await PreregisteredScriptsService.init(true, config);

            // Snapshot is taken once per service-worker lifetime, and
            // recovers per-host rule hashes from the registrations' file
            // lists — shared bundle, per-function and cleanup files are not
            // rule files and must be ignored. Coverage on a successful sync
            // is derived from the built descriptors, without a second read.
            expect(ContentScriptManager.getRegistered).toHaveBeenCalledTimes(1);
            expect(appContext.preregisteredScriptRulesAtBoot).toEqual(
                new Map([['youtube.com', new Set([hash])]]),
            );

            expect(appContext.preregisteredScriptRules).toEqual(
                new Map([['youtube.com', new Set([hash])]]),
            );

            // The embed gate's host set is the configured domains plus their
            // `www.` aliases — the same expansion the shared bundle embeds.
            expect(appContext.preregisteredHostnames).toEqual(
                new Set(['youtube.com', 'www.youtube.com']),
            );
        });

        it('snapshots the boot registrations once when two init calls overlap', async () => {
            vi.mocked(ContentScriptManager.getRegistered).mockResolvedValue([
                { id: 'youtube.com', js: [`${SCRIPTS_PATH}/${getRuleFilename('0123456789abcdef')}`] },
            ]);

            // Concurrent inits: the snapshot check-act runs through the sync
            // queue, so the second init cannot observe the pre-sync state
            // late and store post-sync registrations as the boot snapshot.
            await Promise.all([
                PreregisteredScriptsService.init(true, undefined),
                PreregisteredScriptsService.init(true, undefined),
            ]);

            expect(ContentScriptManager.getRegistered).toHaveBeenCalledTimes(1);
            expect(appContext.preregisteredScriptRulesAtBoot).toEqual(
                new Map([['youtube.com', new Set(['0123456789abcdef'])]]),
            );
        });

        it('does not re-register after a stop enqueued during the boot snapshot', async () => {
            await setupRulesWithManifest({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });

            const order: string[] = [];
            let releaseSnapshot = (): void => {};
            const snapshotGate = new Promise<void>((resolve) => {
                releaseSnapshot = resolve;
            });
            let markSnapshotStarted = (): void => {};
            const snapshotStarted = new Promise<void>((resolve) => {
                markSnapshotStarted = resolve;
            });

            vi.mocked(ContentScriptManager.getRegistered).mockImplementationOnce(async () => {
                order.push('snapshot');
                markSnapshotStarted();
                await snapshotGate;
                return [];
            });
            vi.mocked(ContentScriptManager.sync).mockImplementation(async (
                _namespace,
                scripts,
            ) => {
                order.push('sync');
                registryState.descriptors = scripts;
                return { errors: [], failedScriptIds: [] };
            });
            vi.mocked(ContentScriptManager.clear).mockImplementation(async () => {
                order.push('clear');
                registryState.descriptors = [];
            });

            const initPromise = PreregisteredScriptsService.init(
                true,
                { domains: ['youtube.com'], path: SCRIPTS_PATH },
            );
            await snapshotStarted;

            // stop() is enqueued while init is still inside its snapshot slot.
            const stopPromise = PreregisteredScriptsService.stop();
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });

            releaseSnapshot();
            await initPromise;
            await stopPromise;

            // Snapshot and sync share one queue slot, so the clear runs last:
            // the app stays stopped instead of being re-registered by the
            // init that was already in flight.
            expect(order).toEqual(['snapshot', 'sync', 'clear']);
            expect(appContext.preregisteredScriptRules).toEqual(new Map());
            expect(appContext.preregisteredScriptRulesAtBoot).toBeUndefined();
        });

        it('fails open with an empty boot snapshot when listing registrations fails', async () => {
            const rule = mockScriptletRule('set-cookie', []);
            await setupRulesWithManifest({ 'youtube.com': [rule] });
            const hash = await computeRuleHash(rule);
            vi.mocked(ContentScriptManager.getRegistered).mockRejectedValueOnce(new Error('no scripting'));

            await PreregisteredScriptsService.init(true, { domains: ['youtube.com'], path: SCRIPTS_PATH });

            // A retried snapshot would capture the registrations this init
            // just installed and judge pre-existing pages against rules
            // they never received. Fail open instead: empty coverage means
            // those pages get everything dynamically.
            expect(appContext.preregisteredScriptRulesAtBoot).toEqual(new Map());
            expect(appContext.preregisteredScriptRules).toEqual(
                new Map([['youtube.com', new Set([hash])]]),
            );

            await PreregisteredScriptsService.init(true, { domains: ['youtube.com'], path: SCRIPTS_PATH });

            // The failed read is not retried.
            expect(ContentScriptManager.getRegistered).toHaveBeenCalledTimes(1);
            expect(appContext.preregisteredScriptRulesAtBoot).toEqual(new Map());
        });

        it('clears when the boot snapshot failed, since an unknown namespace may not be empty', async () => {
            vi.mocked(ContentScriptManager.getRegistered).mockRejectedValueOnce(new Error('no scripting'));

            await PreregisteredScriptsService.init(true, undefined);

            // A failed snapshot leaves an empty map, but that is not proof
            // that the namespace is empty: persisted registrations from a
            // previous service-worker lifetime may still be active.
            expect(ContentScriptManager.clear).toHaveBeenCalledWith('preregistered');
            // The successful clear makes the namespace known to be empty.
            expect(appContext.preregisteredScriptRulesAtBootFailed).toBe(false);
        });

        it('does not re-register when reapplyGate fires during stop', async () => {
            appContext.preregisteredScripts = { domains: ['youtube.com'], path: SCRIPTS_PATH };

            let releaseClear = (): void => {};
            const clearGate = new Promise<void>((resolve) => {
                releaseClear = resolve;
            });
            vi.mocked(ContentScriptManager.clear).mockImplementation(async () => {
                await clearGate;
                registryState.descriptors = [];
            });

            const stopPromise = PreregisteredScriptsService.stop();

            // The filtering log closes while the clear is in flight: the
            // stored configuration must already be gone, otherwise the gate
            // enqueues an init that re-registers what stop() removes.
            PreregisteredScriptsService.reapplyGate(true);

            releaseClear();
            await stopPromise;

            expect(ContentScriptManager.sync).not.toHaveBeenCalled();
        });

        it('keeps the coverage when the clear fails in stop, since the registrations are still active', async () => {
            const covered = new Map([['youtube.com', new Set(['0123456789abcdef'])]]);
            appContext.preregisteredScriptRules = covered;
            vi.mocked(ContentScriptManager.clear).mockRejectedValueOnce(new Error('no scripting'));

            await PreregisteredScriptsService.stop();

            // Wiping coverage would let the dynamic path re-inject rules
            // whose persisted registrations are still active.
            expect(appContext.preregisteredScriptRules).toEqual(covered);
            expect(appContext.preregisteredScripts).toBeUndefined();
        });

        it('clears the persisted registrations when the feature is not configured, but still snapshots', async () => {
            vi.mocked(ContentScriptManager.getRegistered).mockResolvedValue([
                { id: 'youtube.com', js: [`${SCRIPTS_PATH}/${getRuleFilename('0123456789abcdef')}`] },
            ]);

            await PreregisteredScriptsService.init(true, undefined);

            expect(ContentScriptManager.clear).toHaveBeenCalledWith('preregistered');
            // The snapshot must cover pre-existing tabs even when the
            // feature is gone: it is taken before the clear erases the
            // registrations their pages may have received.
            expect(appContext.preregisteredScriptRulesAtBoot).toEqual(
                new Map([['youtube.com', new Set(['0123456789abcdef'])]]),
            );
            expect(appContext.preregisteredScriptRules).toEqual(new Map());
            // The boot snapshot's hosts stay published: pre-existing pages
            // already received those registrations' files at document_start,
            // and their coverage must remain resolvable.
            expect(appContext.preregisteredHostnames).toEqual(new Set(['youtube.com']));
        });

        it('does not resurrect stale coverage after a successful clear', async () => {
            // A later sync failure must not republish the coverage from the
            // first sync (it would suppress dynamic injection for rules with
            // no active registration).
            const rule = mockScriptletRule('set-cookie', []);
            await setupRulesWithManifest({ 'youtube.com': [rule] });

            // Establish last-known coverage.
            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            // Configure without preregistration: the namespace is cleared.
            await PreregisteredScriptsService.init(true, undefined);
            expect(appContext.preregisteredScriptRules).toEqual(new Map());

            // A later sync fails: republishing the pre-clear coverage would
            // suppress dynamic injection for rules with no active
            // registration.
            vi.mocked(ContentScriptManager.sync).mockRejectedValueOnce(new Error('invalid namespace'));

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toEqual(new Map());
        });

        it('keeps the previous hostname set when a later sync fails', async () => {
            await setupRulesWithManifest({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);
            expect(appContext.preregisteredHostnames).toEqual(
                new Set(['youtube.com', 'www.youtube.com']),
            );

            // A failed sync leaves the previous registrations active, so the
            // published host set must still describe them.
            vi.mocked(ContentScriptManager.sync).mockRejectedValueOnce(new Error('invalid namespace'));

            await PreregisteredScriptsService.sync(true, ['example.com'], SCRIPTS_PATH);

            expect(appContext.preregisteredHostnames).toEqual(
                new Set(['youtube.com', 'www.youtube.com']),
            );
        });

        it('publishes the configured hostname set when the first sync fails', async () => {
            appContext.preregisteredScripts = { domains: ['youtube.com'], path: SCRIPTS_PATH };
            appContext.preregisteredScriptRulesAtBoot = new Map([
                ['youtube.com', new Set(['0123456789abcdef'])],
            ]);
            vi.mocked(ContentScriptManager.sync).mockRejectedValueOnce(new Error('invalid namespace'));

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            // The fallback coverage describes the registrations that are
            // still active, so the dynamic path must be able to match them
            // against the published host set.
            expect(result).toEqual(new Map([
                ['youtube.com', new Set(['0123456789abcdef'])],
            ]));
            expect(appContext.preregisteredHostnames).toEqual(
                new Set(['youtube.com', 'www.youtube.com']),
            );
        });

        it('falls back to the coverage keys when the first sync fails without a config', async () => {
            appContext.preregisteredScriptRulesAtBoot = new Map([
                ['youtube.com', new Set(['0123456789abcdef'])],
            ]);
            vi.mocked(ContentScriptManager.sync).mockRejectedValueOnce(new Error('invalid namespace'));

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(appContext.preregisteredHostnames).toEqual(new Set(['youtube.com']));
        });

        it('publishes the host set embedded in the manifest', async () => {
            const rule = mockScriptletRule('set-cookie', []);
            await setupRulesWithManifest({ 'youtube.com': [rule] });

            // The shared bundle embeds the generation's host set; it is the
            // source of truth for the top-level predicate, even when the
            // runtime config expands to a different list.
            setupManifest(
                [await computeRuleHash(rule)],
                { 'set-cookie': scriptletFilename('set-cookie') },
                ['youtube.com'],
            );

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(appContext.preregisteredHostnames).toEqual(new Set(['youtube.com']));

            // The runtime expansion also covers `www.youtube.com`, but the
            // page gate only knows the manifest host: registering the alias
            // would run its rules at `document_start` on its own top-level
            // pages while the background reports no coverage there, and the
            // dynamic path would inject the same rules again.
            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts.map((script) => script.id)).toEqual(['youtube.com']);
        });

        it('awaits an in-flight sync before clearing in the no-config path', async () => {
            await setupRulesWithManifest({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });

            const order: string[] = [];
            vi.mocked(ContentScriptManager.sync).mockImplementation(async () => {
                order.push('sync');
                await new Promise((resolve) => {
                    setTimeout(resolve, 10);
                });
                return { errors: [], failedScriptIds: [] };
            });
            vi.mocked(ContentScriptManager.clear).mockImplementation(async () => {
                order.push('clear');
                registryState.descriptors = [];
            });

            const syncPromise = PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);
            await PreregisteredScriptsService.init(true, undefined);
            await syncPromise;

            // init() must wait for the queued sync before clearing, so the
            // sync cannot re-register after the clear and publish coverage
            // for registrations the clear just removed.
            expect(order).toEqual(['sync', 'clear']);
        });

        it('chains a sync enqueued during a clear after the clear', async () => {
            await setupRulesWithManifest({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });

            const order: string[] = [];
            let releaseClear = (): void => {};
            const clearGate = new Promise<void>((resolve) => {
                releaseClear = resolve;
            });
            let markClearStarted = (): void => {};
            const clearStarted = new Promise<void>((resolve) => {
                markClearStarted = resolve;
            });

            vi.mocked(ContentScriptManager.clear).mockImplementationOnce(async () => {
                order.push('clear:start');
                markClearStarted();
                await clearGate;
                order.push('clear:end');
                registryState.descriptors = [];
            });
            vi.mocked(ContentScriptManager.sync).mockImplementationOnce(async () => {
                order.push('sync');
                return { errors: [], failedScriptIds: [] };
            });

            // A persisted registration keeps the namespace non-empty, so
            // init() clears instead of skipping the empty registry.
            appContext.preregisteredScriptRulesAtBoot = new Map([
                ['youtube.com', new Set(['0123456789abcdef'])],
            ]);

            const initPromise = PreregisteredScriptsService.init(true, undefined);
            await clearStarted;

            // A concurrent configure() enqueues a sync while the clear is
            // still in flight.
            const syncPromise = PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });

            // The sync must wait for the clear: running alongside it would
            // let it re-register and publish coverage for registrations the
            // clear just removed.
            expect(order).toEqual(['clear:start']);

            releaseClear();
            await initPromise;
            await syncPromise;

            expect(order).toEqual(['clear:start', 'clear:end', 'sync']);
        });

        it('skips the clear when the namespace is empty and nothing was registered', async () => {
            await PreregisteredScriptsService.init(true, undefined);

            // No persisted registrations and no sync in this worker:
            // listing the empty registry just to clear it is wasted work.
            expect(ContentScriptManager.clear).not.toHaveBeenCalled();
            expect(appContext.preregisteredScriptRules).toEqual(new Map());
        });

        it('clears when this worker registered scripts, even with an empty boot snapshot', async () => {
            await setupRulesWithManifest({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            // The boot snapshot is empty, but the sync above registered
            // scripts in this worker, so the clear must run.
            vi.mocked(ContentScriptManager.getRegistered).mockResolvedValueOnce([]);

            await PreregisteredScriptsService.init(true, undefined);

            expect(ContentScriptManager.clear).toHaveBeenCalledWith('preregistered');
        });

        it('reports the boot snapshot when clearing fails with persisted registrations still active', async () => {
            vi.mocked(ContentScriptManager.getRegistered).mockResolvedValue([
                { id: 'youtube.com', js: [`${SCRIPTS_PATH}/${getRuleFilename('0123456789abcdef')}`] },
            ]);
            vi.mocked(ContentScriptManager.clear).mockRejectedValueOnce(new Error('cannot clear'));

            await PreregisteredScriptsService.init(true, undefined);

            // The registrations could not be cleared and keep running at
            // document_start — reporting them as covered avoids double
            // execution in pre-existing tabs.
            expect(appContext.preregisteredScriptRules).toEqual(
                new Map([['youtube.com', new Set(['0123456789abcdef'])]]),
            );
        });
    });

    describe('stop', () => {
        it('clears the persisted registrations and resets coverage and the boot snapshot', async () => {
            registryState.descriptors = [
                { id: 'youtube.com', js: [`${SCRIPTS_PATH}/${getRuleFilename('0123456789abcdef')}`] },
            ];
            appContext.preregisteredScriptRulesAtBoot = new Map([
                ['youtube.com', new Set(['0123456789abcdef'])],
            ]);

            await PreregisteredScriptsService.stop();

            expect(ContentScriptManager.clear).toHaveBeenCalledWith('preregistered');
            expect(appContext.preregisteredScriptRules).toEqual(new Map());
            expect(appContext.preregisteredScriptRulesAtBoot).toBeUndefined();
        });

        it('clears registrations only after an in-flight sync settles', async () => {
            await setupRulesWithManifest({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });

            const order: string[] = [];
            vi.mocked(ContentScriptManager.sync).mockImplementation(async () => {
                order.push('sync');
                await new Promise((resolve) => {
                    setTimeout(resolve, 10);
                });
                return { errors: [], failedScriptIds: [] };
            });
            vi.mocked(ContentScriptManager.clear).mockImplementation(async () => {
                order.push('clear');
                registryState.descriptors = [];
            });

            const syncPromise = PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);
            await PreregisteredScriptsService.stop();
            await syncPromise;

            // stop() must wait for the queued sync before clearing, so a
            // just-completed sync cannot re-register after the teardown.
            expect(order).toEqual(['sync', 'clear']);

            // Restore the default clear implementation for subsequent tests.
            vi.mocked(ContentScriptManager.clear).mockImplementation(async () => {
                registryState.descriptors = [];
            });
        });
    });

    describe('reapplyGate', () => {
        it('is a no-op until configure() has stored the configuration', () => {
            const initSpy = vi.spyOn(PreregisteredScriptsService, 'init').mockResolvedValue();

            PreregisteredScriptsService.reapplyGate(true);

            // A service-worker restart restores the session configuration but
            // not the in-memory build-time one: re-evaluating now would take
            // the "feature disabled" path and clear the live registrations.
            expect(initSpy).not.toHaveBeenCalled();

            initSpy.mockRestore();
        });

        it('re-evaluates the gate with the stored configuration', () => {
            const config = { domains: ['youtube.com'], path: SCRIPTS_PATH };
            appContext.preregisteredScripts = config;
            const initSpy = vi.spyOn(PreregisteredScriptsService, 'init').mockResolvedValue();

            PreregisteredScriptsService.reapplyGate(false);

            expect(initSpy).toHaveBeenCalledWith(false, config);

            initSpy.mockRestore();
        });

        it('is a no-op after stop()', async () => {
            appContext.preregisteredScripts = { domains: ['youtube.com'], path: SCRIPTS_PATH };

            await PreregisteredScriptsService.stop();

            const initSpy = vi.spyOn(PreregisteredScriptsService, 'init').mockResolvedValue();
            PreregisteredScriptsService.reapplyGate(true);

            // The build-time configuration must not outlive the running app:
            // a later setDebugScriptlets() must not re-register the scripts.
            expect(appContext.preregisteredScripts).toBeUndefined();
            expect(initSpy).not.toHaveBeenCalled();

            initSpy.mockRestore();
        });
    });
});
