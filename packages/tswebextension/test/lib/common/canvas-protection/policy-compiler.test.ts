import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { type ProtectionPolicyArtifact } from '../../../../src/lib/common/canvas-protection/contracts';
import { resolveProtectedSite } from '../../../../src/lib/common/canvas-protection/policy';
import { CanvasPolicyCompiler } from '../../../../src/lib/common/canvas-protection/policy-compiler';
import { logger } from '../../../../src/lib/common/utils/logger';
import { Allowlist } from '../../../../src/lib/mv2/background/allowlist';
import { DocumentApi } from '../../../../src/lib/mv2/background/document-api';
import { type EngineApi } from '../../../../src/lib/mv2/background/engine-api';
import { MatchPatterns } from '../../../../src/lib/mv2/background/utils/match-patterns';
import { AllowlistApi, allowlistApi as mv3AllowlistApi } from '../../../../src/lib/mv3/background/allowlist-api';
import { DocumentApi as Mv3DocumentApi } from '../../../../src/lib/mv3/background/document-api';
import { getConfigurationMv2Fixture } from '../../mv2/background/fixtures/configuration';

const disabledAllowlist = { enabled: false, inverted: false, domains: [] };

/**
 * Evaluates delivery selectors and document exclusions.
 *
 * @param policy Compiled policy.
 * @param url Document URL.
 * @param topUrl Top URL, empty when unknown.
 *
 * @returns Whether protection is disabled.
 */
const isNative = (policy: ProtectionPolicyArtifact, url: string, topUrl = url): boolean => (
    MatchPatterns.test(MatchPatterns.compile(policy.selectors.excludeMatches), url)
    || resolveProtectedSite(policy, {
        url,
        topUrl: topUrl || undefined,
    }) === undefined
);

/**
 * Configures the actual platform allowlist.
 *
 * @param allowlist Platform instance.
 * @param domains Domain entries.
 * @param inverted Whether entries select protected domains.
 *
 * @returns Configured instance.
 */
const configureAllowlist = (allowlist: Allowlist, domains: string[], inverted = false): Allowlist => {
    const config = getConfigurationMv2Fixture();
    config.allowlist = domains;
    config.settings.allowlistEnabled = true;
    config.settings.allowlistInverted = inverted;
    allowlist.configure(config);
    return allowlist;
};

afterEach(() => {
    mv3AllowlistApi.enabled = false;
    mv3AllowlistApi.inverted = false;
    mv3AllowlistApi.domains = [];
    vi.restoreAllMocks();
});

describe('canvas policy compiler', () => {
    it('protects every document without exceptions', () => {
        const policy = CanvasPolicyCompiler.compile([], disabledAllowlist);
        expect(policy).toEqual({
            revision: expect.stringMatching(/^[0-9a-f]{8}$/),
            selectors: { matches: ['<all_urls>'], excludeMatches: [] },
            documentExclusions: [],
        });
        expect(isNative(policy, 'https://example.org/')).toBe(false);
    });

    it.each(['stealth', 'stealth=fingerprinting', 'stealth=referrer|fingerprinting', 'stealth,important'])(
        'excludes the host and its subdomains for stealth exceptions covering fingerprinting: %s',
        (modifier) => {
            const policy = CanvasPolicyCompiler.compile([`@@||example.org^$${modifier}`], disabledAllowlist);
            expect(policy.selectors.excludeMatches).toEqual(['*://*.example.org/*']);
            expect(isNative(policy, 'https://example.org/')).toBe(true);
            expect(isNative(policy, 'https://sub.example.org/')).toBe(true);
            expect(isNative(policy, 'https://other.com/', 'https://example.org/')).toBe(false);
        },
    );

    it.each([
        ['stealth=fingerprinting,stealth=referrer', false],
        ['stealth=referrer,stealth=fingerprinting', true],
    ])('uses the last stealth modifier: %s', (modifiers, excluded) => {
        const policy = CanvasPolicyCompiler.compile([`@@||x.org^$${modifiers}`], disabledAllowlist);
        expect(isNative(policy, 'https://x.org/')).toBe(excluded);
    });

    it('ignores stealth exceptions without fingerprinting silently', () => {
        const debug = vi.spyOn(logger, 'debug');
        expect(CanvasPolicyCompiler.compile(['@@||example.org^$stealth=referrer'], disabledAllowlist))
            .toEqual(CanvasPolicyCompiler.compile([], disabledAllowlist));
        expect(debug).not.toHaveBeenCalled();
    });

    it('ignores rules that are not network exceptions silently', () => {
        const debug = vi.spyOn(logger, 'debug');
        expect(CanvasPolicyCompiler.compile(['||example.org^$document', 'example.org##.ad'], disabledAllowlist))
            .toEqual(CanvasPolicyCompiler.compile([], disabledAllowlist));
        expect(debug).not.toHaveBeenCalled();
    });

    it.each([
        '@@||example.org$stealth', '@@||example.org/path$stealth',
        '@@||example.org^$stealth,domain=a.com', '@@||example.org^$document,domain=a.com',
        '@@||example.*^$stealth', '@@||[::1]^$stealth', String.raw`@@||exa\mple.org^$stealth`,
        '@@||exa mple.org^$stealth', '@@||example.org^$stealth,',
        ...['%65xample.org', '127.1', '0x7f000001'].flatMap((host) => [
            `@@||${host}^$stealth`, `@@||${host}^$document`,
        ]),
    ])('skips unsupported forms with a debug message: %s', (text) => {
        const debug = vi.spyOn(logger, 'debug');
        const info = vi.spyOn(logger, 'info');
        const warn = vi.spyOn(logger, 'warn');
        const error = vi.spyOn(logger, 'error');
        expect(CanvasPolicyCompiler.compile([text], disabledAllowlist))
            .toEqual(CanvasPolicyCompiler.compile([], disabledAllowlist));
        expect(debug).toHaveBeenCalledWith(expect.stringContaining(text));
        expect(info).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
    });

    it.each([
        '@@||example。com^$stealth',
        '@@||ｅｘａｍｐｌｅ.com^$stealth',
        '@@||exa\u00admple.com^$stealth',
        '@@||＊^$document',
        '@@||﹡^$document',
    ])('skips Unicode host rewrites beyond punycode: %s', (text) => {
        const debug = vi.spyOn(logger, 'debug');
        expect(CanvasPolicyCompiler.compile([text], disabledAllowlist))
            .toEqual(CanvasPolicyCompiler.compile([], disabledAllowlist));
        expect(debug).toHaveBeenCalledWith(expect.stringContaining('expected a plain hostname'));
    });

    it.each(['жкхнсо.рф', 'café.example'])('excludes an IDN host by its punycode form: %s', (host) => {
        expect(isNative(
            CanvasPolicyCompiler.compile([`@@||${host}^$stealth`], disabledAllowlist),
            new URL(`https://${host}/`).href,
        )).toBe(true);
        expect(CanvasPolicyCompiler.compile(['@@||EXAMPLE.org^$stealth'], disabledAllowlist).selectors.excludeMatches)
            .toEqual(['*://*.example.org/*']);
    });

    it('uses an exact pattern for an IPv4 host', () => {
        expect(CanvasPolicyCompiler.compile(['@@||192.168.0.1^$stealth'], disabledAllowlist).selectors.excludeMatches)
            .toEqual(['*://192.168.0.1/*']);
    });

    it('excludes the top document and its cross-site frames for document exceptions', () => {
        const policy = CanvasPolicyCompiler.compile(['@@||example.org^$document'], disabledAllowlist);
        expect(isNative(policy, 'https://example.org/')).toBe(true);
        expect(isNative(policy, 'https://sub.example.org/')).toBe(true);
        expect(isNative(policy, 'https://other.com/', 'https://example.org/')).toBe(true);
        expect(isNative(policy, 'https://example.org/', 'https://other.com/')).toBe(false);
        expect(isNative(policy, 'https://example.org/', '')).toBe(false);
    });

    it('combines document and stealth in one rule', () => {
        const debug = vi.spyOn(logger, 'debug');
        const policy = CanvasPolicyCompiler.compile(['@@||example.org^$document,stealth=referrer'], disabledAllowlist);
        expect(policy.selectors.excludeMatches).toEqual([]);
        expect(policy.documentExclusions).toHaveLength(1);
        expect(isNative(policy, 'https://example.org/')).toBe(true);
        expect(isNative(policy, 'https://other.com/', 'https://example.org/')).toBe(true);
        const both = CanvasPolicyCompiler.compile(['@@||example.org^$document,stealth'], disabledAllowlist);
        expect(both.selectors.excludeMatches).toEqual(['*://*.example.org/*']);
        expect(both.documentExclusions).toEqual(policy.documentExclusions);
        expect(debug).not.toHaveBeenCalled();
    });

    it('compiles the configured normal allowlist without matching host prefixes', () => {
        for (const allowlist of [new Allowlist(), new AllowlistApi()]) {
            configureAllowlist(allowlist, ['example.com']);
            const policy = CanvasPolicyCompiler.compile([], allowlist);
            for (const url of ['https://example.com/', 'https://www.example.com/']) {
                expect(isNative(policy, url)).toBe(true);
                expect(isNative(policy, 'https://other.com/', url)).toBe(true);
            }
            for (const url of ['https://example.community/', 'https://example.com.evil.org/']) {
                expect(isNative(policy, url)).toBe(false);
            }
            expect(isNative(policy, 'https://sub.example.com/')).toBe(allowlist instanceof AllowlistApi);
            allowlist.enabled = false;
            expect(CanvasPolicyCompiler.compile([], allowlist))
                .toEqual(CanvasPolicyCompiler.compile([], disabledAllowlist));
        }
    });

    it.each([
        ['a|b.com', 'https://a/', false],
        ['a|b.com', 'https://b.com/', false],
        ['a|b.com', 'https://a|b.com/', true],
        ['ex(ample.com', 'https://ex(ample.com/', true],
        ['ex(ample.com', 'https://example.com/', false],
        ['example.com', 'https://example.com/', true],
        ['example.com', 'https://www.example.com:8080/x', true],
        ['example.com', 'https://example.com.:8080/x', true],
        ['example.com', 'https://example.com?x', true],
        ['example.com', 'https://example.com#x', true],
        ['example.com', 'https://example.com', true],
        ['example.com', 'https://sub.example.com/', false],
        ['example.com', 'https://example.community/', false],
        ['example.com', 'https://example.com.evil.org/', false],
        ['example.com', 'https://other.org/?next=https://example.com/', false],
        ['*.example.com', 'https://example.com/', true],
        ['*.example.com', 'https://a.b.example.com/', true],
        ['*.example.com', 'https://www.example.com:8080/x', true],
        ['*.example.com', 'https://sub.example.com.:8080/x', true],
        ['*.example.com', 'https://sub.example.com?x', true],
        ['*.example.com', 'https://sub.example.com#x', true],
        ['*.example.com', 'https://sub.example.com', true],
        ['*.example.com', 'https://sub.example.community/', false],
        ['*.example.com', 'https://sub.example.com.evil.org/', false],
        ['*.example.com', 'https://other.org/?next=https://sub.example.com/', false],
        ['example.*', 'https://example.org/', true],
        ['example.*', 'https://www.example.co.uk:8080/x', true],
        ['example.*', 'https://example.com/path', true],
        ['example.*', 'https://example/next.org/', false],
        ['example.*', 'https://example/?next=.org', false],
        ['example.*', 'https://example/#.org', false],
        ['example.*.com', 'https://example.org/path.com/', false],
        ['example.*.com', 'https://example.org/?next=.com/', false],
        ['example.*.com', 'https://example.org/#.com/', false],
        ['example.*.com', 'https://example.org:8080/.com/', false],
        ['example.*.com', 'https://example.org.com:8080/x', true],
    ])('matches allowlist entry %s only within the top host: %s → %s', (domain, topUrl, excluded) => {
        const policy = CanvasPolicyCompiler.compile([], { enabled: true, inverted: false, domains: [domain] });
        // A valid frame URL keeps an invalid top hostname from looking like a policy exclusion.
        expect(isNative(policy, 'https://frame.example/', topUrl)).toBe(excluded);
    });

    it.each([
        ['https://example.com/', true, false],
        ['https://www.example.com/', true, false],
        ['https://sub.example.com/', false, true],
        ['http://sub.example.com/', false, true],
        ['https://www.sub.example.com/', false, true],
        ['https://a.b.example.com/', false, false],
        ['https://www.a.b.example.com/', false, false],
        ['https://www.www.example.com/', false, true],
        ['https://sub.example.com.:8080/x', false, true],
        ['https://sub.example.com?x', false, true],
        ['https://sub.example.com/#x', false, true],
        ['https://sub.example.com', false, true],
        ['https://example.community/', false, false],
        ['https://sub.example.com.evil.org/', false, false],
        ['https://example.com.evil.org/', false, false],
        ['https://example.comx.org/', false, false],
        ['https://other.org/?next=https://sub.example.com/', false, false],
    ])('mirrors inverted frame matching at %s', (topUrl, plainListed, wildcardListed) => {
        const cases = [
            { domains: ['example.com'], listed: plainListed },
            { domains: ['*.example.com'], listed: wildcardListed },
            { domains: ['example.com', '*.example.com'], listed: plainListed || wildcardListed },
        ];
        for (const { domains, listed } of cases) {
            const allowlist = configureAllowlist(new Allowlist(), domains, true);
            const engineApi = { matchFrame: vi.fn(() => null) } as unknown as EngineApi;
            const documentApi = new DocumentApi(allowlist, engineApi);
            const excluded = documentApi.matchFrame(topUrl) !== null;
            expect(excluded).toBe(!listed);
            const policy = CanvasPolicyCompiler.compile([], allowlist);
            expect(isNative(policy, topUrl)).toBe(excluded);
            expect(isNative(policy, 'https://frame.example/', topUrl)).toBe(excluded);
        }
    });

    it('compiles configured inverted allowlists including the MV3 subdomain twins', () => {
        const mv2Allowlist = new Allowlist();
        const engineApi = { matchFrame: vi.fn(() => null) } as unknown as EngineApi;
        for (const { allowlist, documentApi } of [
            { allowlist: mv2Allowlist, documentApi: new DocumentApi(mv2Allowlist, engineApi) },
            { allowlist: mv3AllowlistApi, documentApi: Mv3DocumentApi },
        ]) {
            configureAllowlist(allowlist, ['example.com'], true);
            const policy = CanvasPolicyCompiler.compile([], allowlist);
            for (const topUrl of [
                'https://example.com/', 'https://www.example.com/', 'https://sub.example.com/',
                'https://www.sub.example.com/', 'https://a.b.example.com/', 'https://www.a.b.example.com/',
                'https://example.community/', 'https://sub.example.com.evil.org/', 'file:///x.html',
            ]) {
                expect(isNative(policy, 'https://frame.example/', topUrl))
                    .toBe(documentApi.matchFrame(topUrl) !== null);
            }
        }
    });

    it.each([
        ['https://example.com/', true],
        ['https://www.example.com/', true],
        ['https://sub.example.com/', true],
        ['https://www.sub.example.com/', true],
        ['https://a.b.example.com/', false],
        ['https://example.community/', false],
        ['https://sub.example.com.evil.org/', false],
    ])('matches the configured inverted MV3 allowlist at %s → listed %s', (topUrl, listed) => {
        configureAllowlist(mv3AllowlistApi, ['example.com'], true);
        expect(Mv3DocumentApi.matchFrame(topUrl) !== null).toBe(!listed);
        const policy = CanvasPolicyCompiler.compile([], mv3AllowlistApi);
        expect(isNative(policy, topUrl)).toBe(!listed);
        expect(isNative(policy, 'https://frame.example/', topUrl)).toBe(!listed);
    });

    it('excludes hosted documents for an empty inverted allowlist, preserving unknown and hostless tops', () => {
        const policy = CanvasPolicyCompiler.compile([], { enabled: true, inverted: true, domains: [] });
        expect(policy.documentExclusions).toHaveLength(1);
        expect(isNative(policy, 'https://example.com/')).toBe(true);
        expect(isNative(policy, 'https://frame.example/', 'file:///x.html')).toBe(false);
        expect(isNative(policy, 'https://frame.example/', '')).toBe(false);
    });

    it.each([false, true])('uses at most two document exclusions for rules and entries (inverted %s)', (inverted) => {
        const hosts = Array.from({ length: 20 }, (_, index) => `site${index}.example`);
        const policy = CanvasPolicyCompiler.compile(hosts.map((host) => `@@||${host}^$document`), {
            enabled: true, inverted, domains: hosts.map((_, index) => `allowed${index}.example`),
        });
        expect(policy.documentExclusions.length).toBeLessThanOrEqual(2);
        for (const [index, host] of hosts.entries()) {
            expect(isNative(policy, `https://${host}/`)).toBe(true);
            expect(isNative(policy, 'https://frame.example/', `https://sub.${host}/`)).toBe(true);
            expect(isNative(policy, 'https://frame.example/', `https://allowed${index}.example/`)).toBe(!inverted);
        }
        expect(isNative(policy, 'https://other.org/')).toBe(inverted);
        expect(isNative(policy, 'https://frame.example/', '')).toBe(false);
    });

    it('produces the same policy for the same input in any order', () => {
        const texts = ['@@||b.org^$document', '@@||a.org^$stealth', '@@||b.org^$stealth'];
        for (const inverted of [false, true]) {
            const allowlist = { enabled: true, inverted, domains: ['b.com', 'a.com'] };
            const policy = CanvasPolicyCompiler.compile(texts, allowlist);
            expect(CanvasPolicyCompiler.compile([...texts].reverse().concat(texts), {
                ...allowlist, domains: [...allowlist.domains].reverse().concat(allowlist.domains),
            })).toEqual(policy);
            expect(CanvasPolicyCompiler.compile([], allowlist).revision).not.toBe(policy.revision);
        }
    });
});
