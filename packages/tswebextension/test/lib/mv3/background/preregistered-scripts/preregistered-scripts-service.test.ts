import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CosmeticOption, CosmeticRule } from '@adguard/tsurlfilter';

import { appContext } from '../../../../../src/lib/mv3/background/app-context';
import { ContentScriptManager } from '../../../../../src/lib/mv3/background/content-script-manager';
import { CosmeticApi } from '../../../../../src/lib/mv3/background/cosmetic-api';
import { DocumentApi } from '../../../../../src/lib/mv3/background/document-api';
import { engineApi } from '../../../../../src/lib/mv3/background/engine-api';
import {
    CLEANUP_FILENAME,
    computeRuleHash,
    getRuleFilename,
    MANIFEST_FILENAME,
    SHARED_BUNDLE_FILENAME,
} from '../../../../../src/lib/mv3/background/preregistered-scripts/hasher';
import {
    PreregisteredScriptsService,
} from '../../../../../src/lib/mv3/background/preregistered-scripts/preregistered-scripts-service';

vi.mock('../../../../../src/lib/mv3/background/engine-api', () => ({
    engineApi: {
        matchCosmetic: vi.fn(),
        isLocalFilter: vi.fn(),
        isCosmeticRuleAllowlisted: vi.fn().mockReturnValue(false),
        engineGeneration: 0,
    },
}));

vi.mock('../../../../../src/lib/mv3/background/document-api', () => ({
    DocumentApi: {
        matchFrame: vi.fn().mockReturnValue(null),
    },
}));

vi.mock('../../../../../src/lib/mv3/background/content-script-manager', () => ({
    ContentScriptManager: {
        sync: vi.fn().mockResolvedValue([]),
        syncDetailed: vi.fn().mockResolvedValue({ errors: [], failedScriptIds: [] }),
        listIds: vi.fn().mockResolvedValue([]),
        getRegistered: vi.fn().mockResolvedValue([]),
        clear: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('../../../../../src/lib/mv3/background/cosmetic-api', () => ({
    CosmeticApi: {
        setPreregisteredScriptRules: vi.fn(),
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
 * @param scriptletFiles Scriptlet name → per-function filename map, or
 * `undefined` to omit the field from the served manifest.
 */
const setupManifest = (
    hashes: string[] | null,
    scriptletFiles?: Record<string, string>,
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
            json: async (): Promise<unknown> => ({ hashes, scriptletFiles }),
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
        appContext.preregisteredScriptRulesAtBoot = undefined;
        // Invalidate the service's generation-keyed engine cache, so each
        // test's engine mock is actually consulted.
        (engineApi as unknown as { engineGeneration: number }).engineGeneration += 1;
    });

    describe('sync — early exits', () => {
        it('syncs an empty script list and covers no domains when filtering is disabled', async () => {
            setupEngine({ 'youtube.com': [mockScriptletRule('foo', [])] });

            const result = await PreregisteredScriptsService.sync(false, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toEqual(new Map());
            expect(ContentScriptManager.syncDetailed).toHaveBeenCalledWith('preregistered', []);
        });

        it('syncs an empty script list and covers no domains when domains list is empty', async () => {
            const result = await PreregisteredScriptsService.sync(true, [], SCRIPTS_PATH);

            expect(result).toEqual(new Map());
            expect(ContentScriptManager.syncDetailed).toHaveBeenCalledWith('preregistered', []);
        });
    });

    describe('sync — building scripts', () => {
        it('registers a content script for a domain with a local scriptlet rule', async () => {
            const rule = mockScriptletRule('set-cookie', ['a', 'b']);
            await setupRulesWithManifest({ 'youtube.com': [rule] });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            const hash = await computeRuleHash(rule);
            expect(result.get('youtube.com')).toEqual(new Set([hash]));

            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
            expect(scripts).toHaveLength(1);
            expect(scripts[0]).toMatchObject({
                id: 'youtube.com',
                matches: ['*://youtube.com/*'],
                runAt: 'document_start',
                world: 'MAIN',
                allFrames: true,
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

        it('registers a content script for a domain with a JS injection rule', async () => {
            const rule = mockJsRule('console.log(1)');
            await setupRulesWithManifest({ 'youtube.com': [rule] });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result.get('youtube.com'))
                .toEqual(new Set([await computeRuleHash(rule)]));
            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
            expect(scripts).toHaveLength(1);
        });

        it('does not register a script for a domain with no matching rules', async () => {
            await setupRulesWithManifest({ 'youtube.com': [] });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toEqual(new Map());
            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
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
            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
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
                true,
                // Only JS/scriptlet rules are preregistered — the cosmetic
                // match is narrowed to them.
                CosmeticOption.CosmeticOptionJS,
            );
        });

        it('includes rules with a $path modifier (over-collected, path enforced later at runtime)', async () => {
            await setupRulesWithManifest({
                'youtube.com': [
                    mockScriptletRule('set-cookie', [], 1, { pattern: '/watch' }),
                ],
            });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
            expect(scripts).toHaveLength(1);
            // Shared bundle + the scriptlet function file + the per-hash file + cleanup.
            expect(scripts[0].js).toHaveLength(4);
        });

        it('treats a www. hostname as its own independent entry (no union with the apex)', async () => {
            await setupRulesWithManifest({
                'www.youtube.com': [mockScriptletRule('set-cookie', [])],
            });

            await PreregisteredScriptsService.sync(true, ['www.youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
            expect(scripts).toHaveLength(1);
            expect(scripts[0].id).toBe('www.youtube.com');
            expect(scripts[0].matches).toEqual(['*://www.youtube.com/*']);
        });

        it('derives the www. alias from the apex domain and registers it when it has rules', async () => {
            await setupRulesWithManifest({
                'www.youtube.com': [mockScriptletRule('set-cookie', [])],
            });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
            expect(scripts).toHaveLength(1);
            expect(scripts[0].id).toBe('www.youtube.com');
            expect(scripts[0].matches).toEqual(['*://www.youtube.com/*']);
        });

        it('skips the www. alias when it has no matching rules', async () => {
            await setupRulesWithManifest({
                'youtube.com': [mockScriptletRule('set-cookie', [])],
            });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
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

            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
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

            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
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
            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
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
            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
            expect(scripts).toHaveLength(0);
        });

        it('keeps dynamic injection for scriptlet rules when the manifest has no scriptletFiles field', async () => {
            const rule = mockScriptletRule('set-cookie', []);
            setupEngine({ 'youtube.com': [rule] });
            setupManifest([await computeRuleHash(rule)]);

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toEqual(new Map());
            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
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

            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
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

            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
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

        it('covers nothing when the manifest is missing (404)', async () => {
            setupEngine({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            setupManifest(null);

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toEqual(new Map());
        });

        it('covers nothing when the manifest fetch fails', async () => {
            setupEngine({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            const getURL = vi.fn(() => {
                throw new Error('no chrome.runtime');
            });
            vi.stubGlobal('chrome', { ...chrome, runtime: { ...chrome.runtime, getURL } });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toEqual(new Map());
        });

        it('covers nothing when the manifest is malformed', async () => {
            setupEngine({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            const getURL = vi.fn((p: string) => `chrome-extension://test/${p}`);
            vi.stubGlobal('chrome', { ...chrome, runtime: { ...chrome.runtime, getURL } });
            vi.stubGlobal('fetch', vi.fn(async () => ({
                ok: true,
                status: 200,
                // `hashes` is not an array.
                json: async (): Promise<unknown> => ({ hashes: 'not-an-array' }),
            })));

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

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
            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
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
            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
            expect(scripts).toHaveLength(1);
            expect(scripts[0].js).toHaveLength(4); // bundle + function file + the covered rule + cleanup
        });

        it('asks the engine to ignore the exception `$path` modifier', async () => {
            const blockedRule = new CosmeticRule(blockedRuleText, 1);
            await setupRulesWithManifest({ 'youtube.com': [blockedRule] });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(engineApi.isCosmeticRuleAllowlisted)
                .toHaveBeenCalledWith('youtube.com', blockedRule, true);
        });

        it('does not register the domain when its only rule is cancelled by a $path exception', async () => {
            const blockedRule = new CosmeticRule(blockedRuleText, 1);
            await setupRulesWithManifest({ 'youtube.com': [blockedRule] });
            vi.mocked(engineApi.isCosmeticRuleAllowlisted).mockReturnValue(true);

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toEqual(new Map());
            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
            expect(scripts).toHaveLength(0);
        });
    });

    describe('sync — failure propagation', () => {
        it('excludes failed domains from coveredRules when registration fails for them', async () => {
            await setupRulesWithManifest({
                'youtube.com': [mockScriptletRule('set-cookie', [])],
                'example.com': [mockScriptletRule('set-cookie', [])],
            });
            const rejection = {
                status: 'rejected',
                reason: new Error('registerContentScripts failed'),
            } as PromiseRejectedResult;
            vi.mocked(ContentScriptManager.syncDetailed).mockResolvedValueOnce({
                errors: [rejection],
                failedScriptIds: ['youtube.com'],
            });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com', 'example.com'], SCRIPTS_PATH);

            expect([...result.keys()]).toEqual(['example.com']);
        });

        it('covers no domains (without throwing) when ContentScriptManager.syncDetailed throws', async () => {
            await setupRulesWithManifest({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            vi.mocked(ContentScriptManager.syncDetailed).mockRejectedValueOnce(new Error('invalid namespace'));

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toEqual(new Map());
        });

        it('falls back to the boot snapshot when the sync throws', async () => {
            await setupRulesWithManifest({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            vi.mocked(ContentScriptManager.syncDetailed).mockRejectedValueOnce(new Error('invalid namespace'));
            appContext.preregisteredScriptRulesAtBoot = new Map([
                ['youtube.com', new Set(['0123456789abcdef'])],
            ]);

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toEqual(new Map([['youtube.com', new Set(['0123456789abcdef'])]]));
        });

        it('keeps the boot snapshot coverage for a host whose update failed', async () => {
            const rule = mockScriptletRule('set-cookie', []);
            await setupRulesWithManifest({ 'youtube.com': [rule] });
            const staleHash = '0123456789abcdef';
            appContext.preregisteredScriptRulesAtBoot = new Map([
                ['youtube.com', new Set([staleHash])],
            ]);
            vi.mocked(ContentScriptManager.syncDetailed).mockResolvedValueOnce({
                errors: [{ status: 'rejected', reason: new Error('update failed') } as PromiseRejectedResult],
                failedScriptIds: ['youtube.com'],
            });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            // The stale registration still runs at document_start, so its
            // rules must stay covered; the fresh hash is NOT covered and
            // goes through dynamic injection.
            expect(result.get('youtube.com')).toEqual(new Set([staleHash]));
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
            vi.mocked(ContentScriptManager.syncDetailed).mockImplementation(async () => {
                order.push('start');
                await new Promise((resolve) => {
                    setTimeout(resolve, 10);
                });
                order.push('end');
                return { errors: [], failedScriptIds: [] };
            });

            await Promise.all([
                PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH),
                PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH),
            ]);

            // Second sync must not start before the first one finished.
            expect(order).toEqual(['start', 'end', 'start', 'end']);
        });
    });

    describe('init', () => {
        afterEach(() => {
            appContext.preregisteredScriptRulesAtBoot = undefined;
            vi.mocked(ContentScriptManager.getRegistered).mockResolvedValue([]);
        });

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
            // rule files and must be ignored.
            expect(ContentScriptManager.getRegistered).toHaveBeenCalledTimes(1);
            expect(appContext.preregisteredScriptRulesAtBoot).toEqual(
                new Map([['youtube.com', new Set([hash])]]),
            );

            expect(CosmeticApi.setPreregisteredScriptRules).toHaveBeenLastCalledWith(
                new Map([['youtube.com', new Set([hash])]]),
            );
        });

        it('leaves the boot snapshot unset when listing registrations fails, so the next init retries', async () => {
            await setupRulesWithManifest({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            vi.mocked(ContentScriptManager.getRegistered).mockRejectedValueOnce(new Error('no scripting'));

            await PreregisteredScriptsService.init(true, { domains: ['youtube.com'], path: SCRIPTS_PATH });

            // A failed snapshot must not be persisted: an empty map would
            // stick for the whole service-worker lifetime and misreport
            // still-active persisted registrations as uncovered.
            expect(appContext.preregisteredScriptRulesAtBoot).toBeUndefined();
            expect(CosmeticApi.setPreregisteredScriptRules).toHaveBeenCalled();

            vi.mocked(ContentScriptManager.getRegistered).mockResolvedValue([
                { id: 'youtube.com', js: [`${SCRIPTS_PATH}/${getRuleFilename('0123456789abcdef')}`] },
            ]);

            await PreregisteredScriptsService.init(true, { domains: ['youtube.com'], path: SCRIPTS_PATH });

            expect(ContentScriptManager.getRegistered).toHaveBeenCalledTimes(2);
            expect(appContext.preregisteredScriptRulesAtBoot).toEqual(
                new Map([['youtube.com', new Set(['0123456789abcdef'])]]),
            );
        });

        it('clears the persisted registrations when the feature is not configured, but still snapshots', async () => {
            vi.mocked(ContentScriptManager.getRegistered).mockResolvedValue([
                { id: 'youtube.com', js: [`${SCRIPTS_PATH}/${getRuleFilename('0123456789abcdef')}`] },
            ]);

            await PreregisteredScriptsService.init(true, undefined);

            expect(ContentScriptManager.clear).toHaveBeenCalledWith('preregistered');
            // The snapshot must cover pre-existing tabs even when the
            // feature is gone — an update may have removed it after the
            // page loaded.
            expect(appContext.preregisteredScriptRulesAtBoot).toEqual(
                new Map([['youtube.com', new Set(['0123456789abcdef'])]]),
            );
            expect(CosmeticApi.setPreregisteredScriptRules).toHaveBeenCalledWith(new Map());
        });

        it('still reports an empty map when clearing fails and no registrations exist', async () => {
            vi.mocked(ContentScriptManager.clear).mockRejectedValueOnce(new Error('cannot clear'));

            await PreregisteredScriptsService.init(true, undefined);

            expect(CosmeticApi.setPreregisteredScriptRules).toHaveBeenCalledWith(new Map());
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
            expect(CosmeticApi.setPreregisteredScriptRules).toHaveBeenCalledWith(
                new Map([['youtube.com', new Set(['0123456789abcdef'])]]),
            );
        });
    });
});
