import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CanvasConditionType } from '../../../../src/lib/common/canvas-protection/constants';
import { type ProtectionPolicyArtifact } from '../../../../src/lib/common/canvas-protection/contracts';
import { resolveProtectedSite } from '../../../../src/lib/common/canvas-protection/policy';
import {
    CanvasPolicyCompiler,
    type PolicyAllowlist,
} from '../../../../src/lib/common/canvas-protection/policy-compiler';
import { logger } from '../../../../src/lib/common/utils/logger';
import { Allowlist } from '../../../../src/lib/mv2/background/allowlist';
import { DocumentApi } from '../../../../src/lib/mv2/background/document-api';
import { type EngineApi } from '../../../../src/lib/mv2/background/engine-api';
import { MatchPatterns } from '../../../../src/lib/mv2/background/utils/match-patterns';
import { AllowlistApi, allowlistApi as mv3AllowlistApi } from '../../../../src/lib/mv3/background/allowlist-api';
import { DocumentApi as Mv3DocumentApi } from '../../../../src/lib/mv3/background/document-api';
import { getConfigurationMv2Fixture } from '../../mv2/background/fixtures/configuration';

/**
 * Builds a platform allowlist for a test that does not configure an instance.
 *
 * @param domains Normalized allowlist entries.
 * @param enabled Whether the allowlist is enabled.
 * @param inverted Whether the entries select protected domains.
 *
 * @returns Platform allowlist with its inverted selection.
 */
const policyAllowlist = (
    domains: string[],
    enabled = false,
    inverted = false,
): PolicyAllowlist => ({
    enabled,
    inverted,
    domains,
    invertedMatch: Allowlist.getInvertedMatch(domains),
});

const disabledAllowlist = policyAllowlist([]);

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

/**
 * Checks that the canvas policy and the frame matcher of the same platform agree: protection is
 * off exactly for the documents that inverted filtering keeps enabled.
 *
 * @param policy Compiled canvas policy.
 * @param matchFrame Frame matcher of the platform.
 * @param topUrl Top-level document URL.
 */
const expectConsistentCanvas = (
    policy: ProtectionPolicyArtifact,
    matchFrame: (url: string) => unknown,
    topUrl: string,
): void => {
    const filteringOff = matchFrame(topUrl) !== null;

    expect(isNative(policy, topUrl), `canvas at ${topUrl}`).toBe(filteringOff);
    expect(isNative(policy, 'https://frame.example/', topUrl), `frame at ${topUrl}`).toBe(filteringOff);
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
        ...['%65xample.org', '127.1', '0x7f000001', 'example.org.'].flatMap((host) => [
            `@@||${host}^$stealth`, `@@||${host}^$document`,
        ]),
    ])('skips unsupported forms with a debug message: %s', (text) => {
        const debug = vi.spyOn(logger, 'debug');
        const info = vi.spyOn(logger, 'info');
        const warn = vi.spyOn(logger, 'warn');
        const error = vi.spyOn(logger, 'error');
        expect(CanvasPolicyCompiler.compile([text], disabledAllowlist))
            .toEqual(CanvasPolicyCompiler.compile([], disabledAllowlist));
        expect(debug).toHaveBeenCalledOnce();
        expect(debug).toHaveBeenCalledWith(expect.stringContaining('Skipped 1 exception rule(s)'));
        expect(info).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
    });

    it('summarizes skipped rules in one debug message', () => {
        const debug = vi.spyOn(logger, 'debug');
        CanvasPolicyCompiler.compile([
            '@@||a.org/path$document', '@@||b.org/path$stealth', '@@||c.org^$stealth,domain=d.org',
            '@@||example.*^$document', '@@||example.org^$stealth', '@@||e.org^$stealth=referrer',
        ], disabledAllowlist);
        expect(debug).toHaveBeenCalledOnce();
        expect(debug).toHaveBeenCalledWith(expect.stringContaining(
            'Skipped 4 exception rule(s) that canvas protection cannot express: '
            + '2 not a ||host^ pattern, 1 unsupported modifiers, 1 wildcard host',
        ));
    });

    it('parses rules without logging', () => {
        const debug = vi.spyOn(logger, 'debug');
        expect(CanvasPolicyCompiler.parseRule('@@||example.org/path$stealth')).toBeUndefined();
        expect(CanvasPolicyCompiler.parseRule('@@||example.org^$stealth')).toEqual({
            hostname: 'example.org', document: false, stealth: true,
        });
        expect(debug).not.toHaveBeenCalled();
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
        expect(debug).toHaveBeenCalledWith(expect.stringContaining('1 not a plain hostname'));
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

    it('ignores allowlist entries that describe no host', () => {
        for (const allowlist of [new Allowlist(), new AllowlistApi()]) {
            for (const domain of ['*', '**', '*.', 'www.']) {
                configureAllowlist(allowlist, [domain]);
                // Such an entry produces no rule, so it must not become a match-all exclusion.
                expect(CanvasPolicyCompiler.compile([], allowlist))
                    .toEqual(CanvasPolicyCompiler.compile([], disabledAllowlist));
            }
        }
    });

    it.each([
        ['a|b.com', 'https://a/', false],
        ['a|b.com', 'https://b.com/', false],
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
        const policy = CanvasPolicyCompiler.compile([], policyAllowlist([domain], true));
        // A valid frame URL keeps an invalid top hostname from looking like a policy exclusion.
        expect(isNative(policy, 'https://frame.example/', topUrl)).toBe(excluded);
    });

    it.each([
        ['https://example.com/', true, true],
        ['https://www.example.com/', true, true],
        ['https://sub.example.com/', false, true],
        ['http://sub.example.com/', false, true],
        ['https://www.sub.example.com/', false, true],
        ['https://a.b.example.com/', false, true],
        ['https://www.a.b.example.com/', false, true],
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
    ])('compiles inverted MV2 allowlist matching at %s', (topUrl, plainListed, wildcardListed) => {
        const cases = [
            { domains: ['example.com'], listed: plainListed },
            { domains: ['*.example.com'], listed: wildcardListed },
            { domains: ['example.com', '*.example.com'], listed: plainListed || wildcardListed },
        ];
        for (const { domains, listed } of cases) {
            const allowlist = configureAllowlist(new Allowlist(), domains, true);
            const engineApi = { matchFrame: vi.fn(() => null) } as unknown as EngineApi;
            const documentApi = new DocumentApi(allowlist, engineApi);
            const policy = CanvasPolicyCompiler.compile([], allowlist);

            expect(isNative(policy, topUrl), `${domains} at ${topUrl}`).toBe(!listed);
            expectConsistentCanvas(policy, (url) => documentApi.matchFrame(url), topUrl);
        }
    });

    it.each([
        ['https://example.com/', true, true, true],
        ['https://www.example.com/', true, true, true],
        ['https://sub.example.com/', true, true, true],
        ['https://www.sub.example.com/', true, true, true],
        ['https://a.b.example.com/', true, true, true],
        ['https://www.a.b.example.com/', true, true, true],
        ['https://example.ly/', false, false, false],
        ['https://example.community/', false, false, false],
        ['https://sub.example.com.evil.org/', false, false, false],
    ])('compiles inverted MV3 allowlist matching at %s', (topUrl, plainListed, wildcardListed, tldListed) => {
        const cases = [
            { domains: ['example.com'], listed: plainListed },
            { domains: ['*.example.com'], listed: wildcardListed },
            { domains: ['example.*'], listed: tldListed },
        ];
        for (const { domains, listed } of cases) {
            const allowlist = configureAllowlist(mv3AllowlistApi, domains, true);
            const policy = CanvasPolicyCompiler.compile([], allowlist);

            expect(isNative(policy, topUrl), `${domains} at ${topUrl}`).toBe(!listed);
            expectConsistentCanvas(policy, (url) => Mv3DocumentApi.matchFrame(url), topUrl);
        }
    });

    it('keeps every host filtered for the inverted full wildcard', () => {
        for (const allowlist of [new Allowlist(), new AllowlistApi()]) {
            configureAllowlist(allowlist, ['*.*'], true);
            const policy = CanvasPolicyCompiler.compile([], allowlist);

            // Nothing is excluded: the full wildcard selects every host.
            expect(policy.documentExclusions).toHaveLength(0);

            for (const topUrl of ['https://example.com/', 'https://other.org/', 'https://a.b.example.com/']) {
                expect(isNative(policy, topUrl), `${allowlist.constructor.name} at ${topUrl}`).toBe(false);
            }
        }
    });

    it('keeps a hostless document native in the inverted mode', () => {
        for (const allowlist of [new Allowlist(), new AllowlistApi()]) {
            configureAllowlist(allowlist, ['example.com'], true);
            const policy = CanvasPolicyCompiler.compile([], allowlist);

            for (const topUrl of ['file:///x.html', 'about:blank']) {
                expect(isNative(policy, topUrl), `${allowlist.constructor.name} at ${topUrl}`).toBe(true);
            }
        }
    });

    it('covers a wildcard inside a label in the inverted MV2 allowlist', () => {
        const allowlist = configureAllowlist(new Allowlist(), ['*example.com'], true);
        const engineApi = { matchFrame: vi.fn(() => null) } as unknown as EngineApi;
        const documentApi = new DocumentApi(allowlist, engineApi);
        const policy = CanvasPolicyCompiler.compile([], allowlist);

        for (const topUrl of ['https://example.com/', 'https://myexample.com/', 'https://a.b.example.com/']) {
            expect(isNative(policy, topUrl), `canvas at ${topUrl}`).toBe(false);
            expectConsistentCanvas(policy, (url) => documentApi.matchFrame(url), topUrl);
        }
        expect(isNative(policy, 'https://other.org/')).toBe(true);
    });

    it('leaves protection off for an entry the inverted MV3 DNR rule cannot express', () => {
        configureAllowlist(mv3AllowlistApi, ['*example.com'], true);
        const policy = CanvasPolicyCompiler.compile([], mv3AllowlistApi);

        // The combined DNR rule drops the entry, so no host is excluded and network filtering is off.
        expect(policy.documentExclusions).toEqual([{
            type: CanvasConditionType.Not,
            operand: {
                type: CanvasConditionType.Host,
                hosts: [],
                domains: [],
                parents: [],
            },
        }]);
        for (const topUrl of ['https://example.com/', 'https://myexample.com/', 'https://a.b.example.com/']) {
            expect(isNative(policy, topUrl), `canvas at ${topUrl}`).toBe(true);
            expect(Mv3DocumentApi.matchFrame(topUrl), `frame at ${topUrl}`).not.toBeNull();
        }
    });

    it('covers the www hosts of an inverted TLD wildcard entry', () => {
        const mv2 = configureAllowlist(new Allowlist(), ['www.*'], true);
        expect(isNative(CanvasPolicyCompiler.compile([], mv2), 'https://www.example.com/')).toBe(false);
        expect(isNative(CanvasPolicyCompiler.compile([], mv2), 'https://example.com/')).toBe(true);

        const mv3 = configureAllowlist(new AllowlistApi(), ['www.*'], true);
        const mv3Policy = CanvasPolicyCompiler.compile([], mv3);
        // DNR expands `www.*` to `www.<popular tld>`, which does not cover `www.example.com`.
        expect(isNative(mv3Policy, 'https://www.com/')).toBe(false);
        expect(isNative(mv3Policy, 'https://www.example.com/')).toBe(true);
    });

    it('excludes hosted documents for an empty inverted allowlist, preserving unknown and hostless tops', () => {
        const policy = CanvasPolicyCompiler.compile([], policyAllowlist([], true, true));
        expect(policy.documentExclusions).toHaveLength(1);
        expect(isNative(policy, 'https://example.com/')).toBe(true);
        for (const topUrl of ['file:///x.html', 'about:blank', 'data:text/html,top', '']) {
            expect(isNative(policy, 'https://frame.example/', topUrl)).toBe(false);
        }
    });

    it.each([false, true])('looks hosts up without a regular expression per entry (inverted %s)', (inverted) => {
        const allowlist = new AllowlistApi();
        const domains = Array.from({ length: 1500 }, (_, index) => `site${index}.example`);
        configureAllowlist(allowlist, domains, inverted);
        const policy = CanvasPolicyCompiler.compile(domains.map((domain) => `@@||doc.${domain}^$document`), allowlist);
        expect(JSON.stringify(policy)).not.toContain('pattern');
        expect(isNative(policy, 'https://frame.example/', 'https://site1499.example/')).toBe(!inverted);
        expect(isNative(policy, 'https://frame.example/', 'https://doc.site0.example/')).toBe(true);
        expect(isNative(policy, 'https://frame.example/', 'https://other.example/')).toBe(inverted);
    });

    it('drops plain entries covered by their MV3 subdomain twins', () => {
        const allowlist = configureAllowlist(new AllowlistApi(), ['example.com', 'example.org']);
        expect(CanvasPolicyCompiler.compile([], allowlist).documentExclusions).toEqual([{
            type: CanvasConditionType.Host,
            hosts: [],
            domains: ['example.com', 'example.org'],
            parents: [],
        }]);
    });

    it('keeps wildcard allowlist entries in one hostname pattern', () => {
        const policy = CanvasPolicyCompiler.compile([], policyAllowlist(['example.*', '*.test.*', 'plain.com'], true));
        expect(policy.documentExclusions).toEqual([{
            type: CanvasConditionType.Host,
            hosts: ['plain.com'],
            domains: [],
            parents: [],
            pattern: String.raw`^(?:(?:(?:[^.]+\.)*test\..*)|(?:(?:www\.)?example\..*))$`,
        }]);
    });

    it.each([false, true])('uses at most two document exclusions for rules and entries (inverted %s)', (inverted) => {
        const hosts = Array.from({ length: 20 }, (_, index) => `site${index}.example`);
        const policy = CanvasPolicyCompiler.compile(
            hosts.map((host) => `@@||${host}^$document`),
            policyAllowlist(hosts.map((_, index) => `allowed${index}.example`), true, inverted),
        );
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
            const domains = ['b.com', 'a.com'];
            const allowlist = policyAllowlist(domains, true, inverted);
            const policy = CanvasPolicyCompiler.compile(texts, allowlist);
            expect(CanvasPolicyCompiler.compile(
                [...texts].reverse().concat(texts),
                policyAllowlist([...domains].reverse().concat(domains), true, inverted),
            )).toEqual(policy);
            expect(CanvasPolicyCompiler.compile([], allowlist).revision).not.toBe(policy.revision);
        }
    });
});
