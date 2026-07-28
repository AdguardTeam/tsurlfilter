import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { ContentScriptManager } from '../../../../../src/lib/mv3/background/content-script-manager';
import { DocumentApi } from '../../../../../src/lib/mv3/background/document-api';
import { engineApi } from '../../../../../src/lib/mv3/background/engine-api';
import { CLEANUP_BUNDLE_FILENAME } from '../../../../../src/lib/mv3/background/preregistered-scripts/hasher';
import {
    PreregisteredScriptsService,
} from '../../../../../src/lib/mv3/background/preregistered-scripts/preregistered-scripts-service';

vi.mock('../../../../../src/lib/mv3/background/engine-api', () => ({
    engineApi: {
        matchCosmetic: vi.fn(),
        isLocalFilter: vi.fn(),
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
): object => ({
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
const mockJsRule = (content: string, filterListId = 1): object => ({
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
    rulesByDomain: Record<string, ReturnType<typeof mockScriptletRule>[]>,
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

describe('PreregisteredScriptsService', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('sync — early exits', () => {
        it('syncs an empty script list and resolves true when filtering is disabled', async () => {
            setupEngine({ 'youtube.com': [mockScriptletRule('foo', [])] });

            const result = await PreregisteredScriptsService.sync(false, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toBe(true);
            expect(ContentScriptManager.sync).toHaveBeenCalledWith('preregistered', []);
        });

        it('syncs an empty script list and resolves true when domains list is empty', async () => {
            const result = await PreregisteredScriptsService.sync(true, [], SCRIPTS_PATH);

            expect(result).toBe(true);
            expect(ContentScriptManager.sync).toHaveBeenCalledWith('preregistered', []);
        });
    });

    describe('sync — building scripts', () => {
        it('registers a content script for a domain with a local scriptlet rule', async () => {
            setupEngine({ 'youtube.com': [mockScriptletRule('set-cookie', ['a', 'b'])] });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
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
            setupEngine({ 'youtube.com': [mockJsRule('console.log(1)')] });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts).toHaveLength(1);
        });

        it('does not register a script for a domain with no matching rules', async () => {
            setupEngine({ 'youtube.com': [] });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts).toHaveLength(0);
        });

        it('skips preregistration for a domain covered by a document-level allowlist rule', async () => {
            setupEngine(
                { 'youtube.com': [mockScriptletRule('set-cookie', [])] },
                [1],
                ['youtube.com'],
            );

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
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

            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts).toHaveLength(1);
            expect(scripts[0].js).toHaveLength(3);
        });

        it('treats a www. hostname as its own independent entry (no union with the apex)', async () => {
            setupEngine({
                'www.youtube.com': [mockScriptletRule('set-cookie', [])],
            });

            await PreregisteredScriptsService.sync(true, ['www.youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts).toHaveLength(1);
            expect(scripts[0].id).toBe('www.youtube.com');
            expect(scripts[0].matches).toEqual(['*://www.youtube.com/*']);
        });

        it('does not pick up a www.-only rule when only the apex hostname is in the domains list', async () => {
            setupEngine({
                'www.youtube.com': [mockScriptletRule('set-cookie', [])],
            });

            await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
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

            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
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

            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts).toHaveLength(1);
            // Shared bundle + exactly one per-hash file (the local rule only) + cleanup.
            expect(scripts[0].js).toHaveLength(3);
        });

        it('skips a rule whose getScriptletData() returns null without failing the whole sync', async () => {
            const badRule = {
                isScriptlet: true,
                getScriptletData: (): null => null,
                getFilterListId: (): number => 1,
            };
            setupEngine({ 'youtube.com': [badRule as any, mockScriptletRule('set-cookie', [])] });

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toBe(true);
            const [, scripts] = vi.mocked(ContentScriptManager.sync).mock.calls[0];
            expect(scripts[0].js).toHaveLength(3); // shared bundle + the one valid rule + cleanup
        });
    });

    describe('sync — failure propagation', () => {
        it('resolves false when ContentScriptManager.sync reports partial failures', async () => {
            setupEngine({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            vi.mocked(ContentScriptManager.sync).mockResolvedValueOnce([
                { status: 'rejected', reason: new Error('registerContentScripts failed') } as PromiseRejectedResult,
            ]);

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toBe(false);
        });

        it('resolves false (without throwing) when ContentScriptManager.sync throws', async () => {
            setupEngine({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            vi.mocked(ContentScriptManager.sync).mockRejectedValueOnce(new Error('invalid namespace'));

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toBe(false);
        });

        it('resolves true when ContentScriptManager.sync succeeds with no errors', async () => {
            setupEngine({ 'youtube.com': [mockScriptletRule('set-cookie', [])] });
            vi.mocked(ContentScriptManager.sync).mockResolvedValueOnce([]);

            const result = await PreregisteredScriptsService.sync(true, ['youtube.com'], SCRIPTS_PATH);

            expect(result).toBe(true);
        });
    });
});
