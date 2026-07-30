import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CosmeticRule } from '@adguard/tsurlfilter';

import { ContentScriptManager } from '../../../../../src/lib/mv3/background/content-script-manager';
import { DocumentApi } from '../../../../../src/lib/mv3/background/document-api';
import { engineApi } from '../../../../../src/lib/mv3/background/engine-api';
import {
    CLEANUP_BUNDLE_FILENAME,
    computeRuleHash,
    MANIFEST_FILENAME,
} from '../../../../../src/lib/mv3/background/preregistered-scripts/hasher';
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

vi.mock('../../../../../src/lib/mv3/background/content-script-manager', () => ({
    ContentScriptManager: {
        sync: vi.fn().mockResolvedValue([]),
        syncDetailed: vi.fn().mockResolvedValue({ errors: [], failedScriptIds: [] }),
        listIds: vi.fn().mockResolvedValue([]),
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
 * `DocumentApi.matchFrame` defaults to `null` (module-level mock); tests
 * that specifically exercise the `frameRule` wiring override it directly.
 *
 * @param rulesByDomain Map of domain → rules to return for that domain.
 * @param localFilterIds Filter ids considered "local" by `isLocalFilter`.
 * @param disableJsForDomains Domains for which `matchCosmetic` should report
 * no script rules (simulating an allowlist rule).
 */
const setupEngine = (
    rulesByDomain: Record<string, any[]>,
    localFilterIds: number[] = [1],
    disableJsForDomains: string[] = [],
): void => {
    vi.mocked(engineApi.matchCosmetic).mockImplementation(({ requestUrl }: { requestUrl: string }) => {
        const domain = new URL(requestUrl).hostname;
        const rules = disableJsForDomains.includes(domain) ? [] : (rulesByDomain[domain] ?? []);
        return {
            getScriptRules: (): any[] => rules as any[],
        } as any;
    });
    vi.mocked(engineApi.isLocalFilter).mockImplementation(
        (filterListId: number) => localFilterIds.includes(filterListId),
    );
};

interface ManifestStub {
    hashes: string[];
}

/**
 * Stubs `chrome.runtime.getURL` and `fetch` so the manifest lookup behaves
 * as desired.
 *
 * @param manifest Manifest object to serve, or `null` to simulate a missing
 * (404) manifest.
 */
const setupManifest = (
    manifest: ManifestStub | null,
): void => {
    // sinon-chrome exposes getURL via a getter — replace the whole global.
    const getURL = vi.fn((p: string) => `chrome-extension://test/${p}`);
    vi.stubGlobal('chrome', {
        ...chrome,
        runtime: { ...chrome.runtime, getURL },
    });

    vi.stubGlobal('fetch', vi.fn(async () => {
        if (manifest === null) {
            return { ok: false, status: 404 };
        }
        return {
            ok: true,
            status: 200,
            json: async (): Promise<ManifestStub> => manifest,
        };
    }));
};

describe('PreregisteredScriptsService', () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    describe('sync — early exits', () => {
        it('syncs an empty script list and covers no domains when filtering is disabled', async () => {
            setupEngine({ 'youtube.com': [mockScriptletRule('foo', [])] });

            const result = await PreregisteredScriptsService.sync(false, ['youtube.com'], SCRIPTS_PATH);

            expect(result.coveredRules).toEqual(new Map());
            expect(ContentScriptManager.syncDetailed).toHaveBeenCalledWith('preregistered', []);
        });

        it('syncs an empty script list and covers no domains when domains list is empty', async () => {
            const result = await PreregisteredScriptsService.sync(true, [], SCRIPTS_PATH);

            expect(result.coveredRules).toEqual(new Map());
            expect(ContentScriptManager.syncDetailed).toHaveBeenCalledWith('preregistered', []);
        });
    });

    describe('sync — building scripts', () => {
        it('registers a content script for a domain with a local scriptlet rule', async () => {
            const rule = mockScriptletRule('set-cookie', ['a', 'b']);
            setupEngine({ 'youtube.com': [rule] });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result.coveredRules.get('youtube.com'))
                .toEqual(new Set([await computeRuleHash(rule)]));

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
            expect(scripts[0].js).toHaveLength(3);
            expect(scripts[0].js?.[0]).toBe(`${SCRIPTS_PATH}/scriptlets-bundle.js`);
            // Cleanup file must always be last, so it deletes the coordination
            // property before any page script runs.
            expect(scripts[0].js?.at(-1)).toBe(`${SCRIPTS_PATH}/${CLEANUP_BUNDLE_FILENAME}`);
        });

        it('registers a content script for a domain with a JS injection rule', async () => {
            const rule = mockJsRule('console.log(1)');
            setupEngine({ 'youtube.com': [rule] });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result.coveredRules.get('youtube.com'))
                .toEqual(new Set([await computeRuleHash(rule)]));
            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
            expect(scripts).toHaveLength(1);
        });

        it('does not register a script for a domain with no matching rules', async () => {
            setupEngine({ 'youtube.com': [] });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result.coveredRules).toEqual(new Map());
            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
            expect(scripts).toHaveLength(0);
        });

        it('skips preregistration for a domain covered by a document-level allowlist rule', async () => {
            setupEngine(
                { 'youtube.com': [mockScriptletRule('set-cookie', [])] },
                [1],
                ['youtube.com'],
            );

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result.coveredRules).toEqual(new Map());
            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
            expect(scripts).toHaveLength(0);
        });

        it('queries DocumentApi.matchFrame() and forwards its result as frameRule (inverted allowlist)', async () => {
            setupEngine({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            const syntheticAllowlistRule = { isAllowlist: (): boolean => true } as any;
            vi.mocked(DocumentApi.matchFrame).mockReturnValue(syntheticAllowlistRule);

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(DocumentApi.matchFrame).toHaveBeenCalledWith('https://youtube.com/');
            expect(engineApi.matchCosmetic).toHaveBeenCalledWith(
                expect.objectContaining({ frameRule: syntheticAllowlistRule }),
                true,
            );
        });

        it('includes rules with a $path modifier (over-collected, path enforced later at runtime)', async () => {
            setupEngine({
                'youtube.com': [
                    mockScriptletRule('set-cookie', [], 1, { pattern: '/watch' }),
                ],
            });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
            expect(scripts).toHaveLength(1);
            expect(scripts[0].js).toHaveLength(3);
        });

        it('treats a www. hostname as its own independent entry (no union with the apex)', async () => {
            setupEngine({
                'www.youtube.com': [mockScriptletRule('set-cookie', [])],
            });

            await PreregisteredScriptsService.sync(true, ['www.youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
            expect(scripts).toHaveLength(1);
            expect(scripts[0].id).toBe('www.youtube.com');
            expect(scripts[0].matches).toEqual(['*://www.youtube.com/*']);
        });

        it('does not pick up a www.-only rule when only the apex hostname is in the domains list', async () => {
            setupEngine({
                'www.youtube.com': [mockScriptletRule('set-cookie', [])],
            });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
            expect(scripts).toHaveLength(0);
        });

        it('excludes rules from non-local (custom/user) filters from hashing', async () => {
            // Only rule on the domain comes from a non-local filter (e.g. a
            // custom filter or user rule) — must NOT produce a registration,
            // since no build-time `{hash}.js` file exists for it.
            setupEngine(
                { 'youtube.com': [mockScriptletRule('set-cookie', [], 99)] },
                [1], // only filter id 1 is local
            );

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
            expect(scripts).toHaveLength(0);
        });

        it('includes only the local rule when local and non-local rules coexist on a domain', async () => {
            setupEngine(
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
            // Shared bundle + exactly one per-hash file (the local rule only) + cleanup.
            expect(scripts[0].js).toHaveLength(3);
        });

        it('keeps the domain registered when a single rule fails to hash', async () => {
            const badRule = {
                isScriptlet: true,
                getScriptletData: (): null => null,
                getFilterListId: (): number => 1,
            };
            const goodRule = mockScriptletRule('set-cookie', []);
            setupEngine({ 'youtube.com': [badRule as any, goodRule] });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result.coveredRules.get('youtube.com'))
                .toEqual(new Set([await computeRuleHash(goodRule)]));
            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
            expect(scripts[0].js).toHaveLength(3); // shared bundle + the one valid rule + cleanup
        });
    });

    describe('sync — manifest check', () => {
        it('registers the domain when the manifest contains all computed hashes', async () => {
            const rule = mockScriptletRule('set-cookie', []);
            setupEngine({ 'youtube.com': [rule] });
            setupManifest({ hashes: [await computeRuleHash(rule)] });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect([...result.coveredRules.keys()]).toEqual(['youtube.com']);
            expect(chrome.runtime.getURL).toHaveBeenCalledWith(`${SCRIPTS_PATH}/${MANIFEST_FILENAME}`);
        });

        it('covers no rules when the only computed hash is missing from the manifest', async () => {
            const rule = mockScriptletRule('set-cookie', []);
            setupEngine({ 'youtube.com': [rule] });
            setupManifest({ hashes: ['deadbeefdeadbeef'] });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result.coveredRules).toEqual(new Map());
            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
            expect(scripts).toHaveLength(0);
        });

        it('degrades only the rule whose hash is missing from the manifest, keeping the rest covered', async () => {
            const keptRule = mockScriptletRule('set-cookie', []);
            const degradedRule = mockScriptletRule('prevent-fetch', []);
            setupEngine({ 'youtube.com': [keptRule, degradedRule] });
            setupManifest({ hashes: [await computeRuleHash(keptRule)] });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result.coveredRules.get('youtube.com'))
                .toEqual(new Set([await computeRuleHash(keptRule)]));
            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
            expect(scripts[0].js).toHaveLength(3); // shared bundle + the covered rule + cleanup
        });

        it('proceeds without the check when the manifest is missing (404)', async () => {
            setupEngine({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            setupManifest(null);

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect([...result.coveredRules.keys()]).toEqual(['youtube.com']);
        });

        it('proceeds without the check when the manifest fetch fails', async () => {
            setupEngine({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            const getURL = vi.fn(() => {
                throw new Error('no chrome.runtime');
            });
            vi.stubGlobal('chrome', { ...chrome, runtime: { ...chrome.runtime, getURL } });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect([...result.coveredRules.keys()]).toEqual(['youtube.com']);
        });

        it('proceeds without the check when the manifest is malformed', async () => {
            setupEngine({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            setupManifest({ hashes: 'not-an-array' } as any);

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect([...result.coveredRules.keys()]).toEqual(['youtube.com']);
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
            setupEngine({ 'youtube.com': [blockedRule, keptRule] });
            vi.mocked(engineApi.isCosmeticRuleAllowlisted).mockImplementation(
                (_hostname: string, rule: any) => rule.getText() === blockedRuleText,
            );

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result.coveredRules.get('youtube.com')).toEqual(new Set([await computeRuleHash(keptRule)]));
            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
            expect(scripts).toHaveLength(1);
            expect(scripts[0].js).toHaveLength(3); // shared bundle + the covered rule + cleanup
        });

        it('asks the engine to ignore the exception `$path` modifier', async () => {
            const blockedRule = new CosmeticRule(blockedRuleText, 1);
            setupEngine({ 'youtube.com': [blockedRule] });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(engineApi.isCosmeticRuleAllowlisted)
                .toHaveBeenCalledWith('youtube.com', blockedRule, true);
        });

        it('does not register the domain when its only rule is cancelled by a $path exception', async () => {
            const blockedRule = new CosmeticRule(blockedRuleText, 1);
            setupEngine({ 'youtube.com': [blockedRule] });
            vi.mocked(engineApi.isCosmeticRuleAllowlisted).mockReturnValue(true);

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result.coveredRules).toEqual(new Map());
            const [, scripts] = vi.mocked(ContentScriptManager.syncDetailed).mock.calls[0];
            expect(scripts).toHaveLength(0);
        });

        it('covers the rule when no runtime exception cancels it', async () => {
            const blockedRule = new CosmeticRule(blockedRuleText, 1);
            setupEngine({ 'youtube.com': [blockedRule] });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result.coveredRules.get('youtube.com')).toEqual(new Set([await computeRuleHash(blockedRule)]));
        });
    });

    describe('sync — failure propagation', () => {
        it('excludes failed domains from coveredRules when registration fails for them', async () => {
            setupEngine({
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

            expect([...result.coveredRules.keys()]).toEqual(['example.com']);
        });

        it('covers no domains (without throwing) when ContentScriptManager.syncDetailed throws', async () => {
            setupEngine({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            vi.mocked(ContentScriptManager.syncDetailed).mockRejectedValueOnce(new Error('invalid namespace'));

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result.coveredRules).toEqual(new Map());
        });

        it('covers all domains when ContentScriptManager.syncDetailed succeeds with no failures', async () => {
            setupEngine({
                'youtube.com': [mockScriptletRule('set-cookie', [])],
                'example.com': [mockScriptletRule('set-cookie', [])],
            });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com', 'example.com'], SCRIPTS_PATH);

            expect([...result.coveredRules.keys()].sort()).toEqual(['example.com', 'youtube.com']);
        });
    });

    describe('sync — concurrency', () => {
        it('serializes concurrent sync calls', async () => {
            setupEngine({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });

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
});
