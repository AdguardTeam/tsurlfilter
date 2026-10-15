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
import { AllowlistApi } from '../../../../src/lib/mv3/background/allowlist-api';
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

afterEach(() => vi.restoreAllMocks());

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
    it('excludes an IDN host by its punycode form', () => {
        expect(isNative(
            CanvasPolicyCompiler.compile(['@@||жкхнсо.рф^$stealth'], disabledAllowlist),
            new URL('https://жкхнсо.рф/').href,
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
    it('matches the inverted allowlist like frame matching', () => {
        const urls = [
            'https://example.com/', 'https://www.example.com/', 'https://sub.example.com/',
            'https://www.sub.example.com/', 'https://a.sub.example.com/', 'https://www.example.com.evil.org/',
            'https://other.com:8080/', 'file:///x.html',
        ];
        const engineStub = { matchFrame: () => null } as unknown as EngineApi;
        for (const allowlist of [new Allowlist(), new AllowlistApi()]) {
            for (const domains of [['example.com'], ['*.example.com'], []]) {
                configureAllowlist(allowlist, domains, true);
                const documentApi = new DocumentApi(allowlist, engineStub);
                const policy = CanvasPolicyCompiler.compile([], allowlist);
                for (const url of urls) {
                    const expected = documentApi.matchFrame(url) !== null;
                    if (!url.startsWith('file:')) {
                        expect(isNative(policy, url), `${domains}: ${url}`).toBe(expected);
                    }
                    expect(isNative(policy, 'https://other.com/', url), `${domains}: frame in ${url}`)
                        .toBe(expected);
                }
            }
        }
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
