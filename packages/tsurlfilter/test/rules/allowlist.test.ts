import { describe, expect, it } from 'vitest';

import { Engine } from '../../src/engine/engine';
import { normalizeAllowlistDomain } from '../../src/rules/allowlist';
import { RuleFactory } from '../../src/rules/rule-factory';

/**
 * Filter list id used for the generated allowlist rules.
 */
const FILTER_LIST_ID = 100;

/**
 * Beginning of the rule generated for an entry without the `*.` prefix: the URL start, which
 * makes the domain match the URL host, the optional credentials and the optional `www.` subdomain.
 */
const RULE_START = String.raw`@@/^(?:https?|wss?):\/\/(?:[^\/\\?#]*@)?(?:[w]{3}[.])?`;

/**
 * Beginning of the rule generated for an entry with the `*.` prefix: the URL start and the
 * subdomains, each ending with a dot.
 */
const SUBDOMAIN_RULE_START = String.raw`@@/^(?:https?|wss?):\/\/(?:[^\/\\?#]*@)?(?:[^\/\\?#@.]+[.])*`;

/**
 * End of the rule generated for an entry without the `*.` prefix: the host end — an optional root
 * label dot, an optional port, the path, the query, the fragment or the end of the URL — and the
 * modifiers.
 */
const RULE_END = String.raw`(?:[.])?(?::\d*)?(?:[\/\\?#]|$)/$document,important`;

/**
 * Wildcard of an entry: any characters of the host, but not the authority delimiters.
 */
const WILDCARD = String.raw`[^\/\\?#@]*`;

/**
 * Builds an engine with the allowlist rule generated for the given domain, the way consumers
 * load the user allowlist into the engine.
 *
 * @param domain Allowlist domain.
 *
 * @returns Engine with the generated allowlist rule.
 */
const createEngine = (domain: string): Engine => {
    const rule = RuleFactory.createAllowlistRule(domain, FILTER_LIST_ID);
    expect(rule).not.toBeNull();

    return Engine.createSync({
        filters: [{
            id: FILTER_LIST_ID,
            content: rule!.getText()!,
        }],
    });
};

describe('normalizeAllowlistDomain', () => {
    const cases = [
        { entry: 'example.com', expected: 'example.com' },
        { entry: 'EXAMPLE.COM', expected: 'example.com' },
        { entry: '  Example.COM \t', expected: 'example.com' },
        { entry: 'www.example.com', expected: 'example.com' },
        // A path is not a part of an entry: settings import and old profiles may still carry one.
        { entry: 'example.com/path?query#fragment', expected: 'example.com' },
        { entry: 'www.example.com/path', expected: 'example.com' },
        // `www.*` describes the hosts under `www.`, so the prefix is the part that defines it.
        { entry: 'www.*', expected: 'www.*' },
        // A bare `www.` has no domain at all.
        { entry: 'www.', expected: '' },
        { entry: '', expected: '' },
    ];

    it.each(cases)('normalizes "$entry" to "$expected"', ({ entry, expected }) => {
        expect(normalizeAllowlistDomain(entry)).toStrictEqual(expected);
    });
});

describe('RuleFactory.createAllowlistRule', () => {
    describe('generates a rule for a domain entry', () => {
        const cases = [
            { domain: 'example.com', expected: `${RULE_START}example\\.com${RULE_END}` },
            { domain: 'www.example.com', expected: `${RULE_START}example\\.com${RULE_END}` },
            { domain: 'EXAMPLE.COM', expected: `${RULE_START}example\\.com${RULE_END}` },
            { domain: 'sub.example.com', expected: `${RULE_START}sub\\.example\\.com${RULE_END}` },
            { domain: 'example.*', expected: `${RULE_START}example\\.${WILDCARD}${RULE_END}` },
            { domain: '*example.*', expected: `${RULE_START}${WILDCARD}example\\.${WILDCARD}${RULE_END}` },
            { domain: '*example.com', expected: `${RULE_START}${WILDCARD}example\\.com${RULE_END}` },
            // Regexp metacharacters of the entry are escaped, so the entry stays a literal host.
            { domain: 'example(+).com', expected: `${RULE_START}example\\(\\+\\)\\.com${RULE_END}` },
            { domain: '*.example.com', expected: `${SUBDOMAIN_RULE_START}example\\.com${RULE_END}` },
            { domain: '*.EXAMPLE.COM', expected: `${SUBDOMAIN_RULE_START}example\\.com${RULE_END}` },
            {
                domain: '*.sub.example.*',
                expected: `${SUBDOMAIN_RULE_START}sub\\.example\\.${WILDCARD}${RULE_END}`,
            },
            // The full wildcard is the only entry that covers every URL, not just every host.
            { domain: '*.*', expected: String.raw`@@||*^$document,important` },
        ];

        it.each(cases)('generates a rule for $domain', ({ domain, expected }) => {
            const rule = RuleFactory.createAllowlistRule(domain, FILTER_LIST_ID);

            expect(rule).not.toBeNull();
            expect(rule!.getText()).toStrictEqual(expected);
        });
    });

    describe('returns null for an entry without a domain', () => {
        const cases = ['', 'www.', '*.', '*', '**'].map((domain) => ({ domain }));

        it.each(cases)('returns null for "$domain"', ({ domain }) => {
            expect(RuleFactory.createAllowlistRule(domain, FILTER_LIST_ID)).toBeNull();
        });
    });

    describe('matches the document of the domain', () => {
        const cases = [
            { domain: 'example.com', url: 'https://example.com/' },
            { domain: 'example.com', url: 'https://www.example.com/' },
            { domain: 'example.com', url: 'https://example.com' },
            { domain: 'example.com', url: 'https://example.com:8080/' },
            { domain: 'example.com', url: 'https://example.com:8080' },
            { domain: 'example.com', url: 'https://example.com?query' },
            { domain: 'example.com', url: 'https://example.com#fragment' },
            { domain: 'example.com', url: 'https://example.com/path?query#fragment' },
            { domain: 'example.com', url: 'https://example.com\\path' },
            { domain: 'example.com', url: 'https://EXAMPLE.COM/' },
            { domain: 'example.com', url: 'https://example.com./' },
            { domain: 'example.com', url: 'ws://example.com/' },
            { domain: 'example.com', url: 'wss://example.com/' },
            { domain: 'example.com', url: 'https://user:pass@example.com/' },
            { domain: 'example.com', url: 'https://user:p@ss@example.com/' },
            { domain: 'exa+ple.com', url: 'https://exa+ple.com/' },
            { domain: 'www.example.com', url: 'https://example.com/' },
            { domain: 'www.example.com', url: 'https://www.example.com/' },
            { domain: '*.example.com', url: 'https://example.com/' },
            { domain: '*.example.com', url: 'https://sub.example.com/' },
            { domain: '*.example.com', url: 'https://deep.sub.example.com/' },
            { domain: '*.example.com', url: 'https://example.com./' },
            { domain: '*.example.com', url: 'https://example.com:8080/' },
            { domain: '*.example.*', url: 'https://example.com/' },
            { domain: '*.example.*', url: 'https://sub.example.org/' },
            { domain: '*.sub.example.*', url: 'https://deep.sub.example.net/' },
            { domain: 'example.*', url: 'https://example.org/' },
            // A wildcard TLD entry matches any TLD, so this host is covered by design.
            { domain: 'example.*', url: 'https://example.community/' },
            { domain: '*example.com', url: 'https://myexample.com/' },
            { domain: '*.*', url: 'https://a.com/' },
            { domain: '*.*', url: 'https://example.com.community/' },
            // A short domain is covered by its own rule: the pattern shortcut must stay the domain.
            { domain: 't.me', url: 'https://t.me/' },
            { domain: 'x.ai', url: 'https://x.ai/' },
            { domain: 'ab.*', url: 'https://ab.co/' },
            { domain: 'a', url: 'https://a/' },
            { domain: '*.a', url: 'https://a/' },
            { domain: '*.a', url: 'https://sub.a/' },
            // A path is not a part of an entry: it is cut, so the whole site stays covered.
            { domain: 'example.com/', url: 'https://example.com/page' },
            { domain: 'example.com/path', url: 'https://example.com/other' },
            { domain: '*.example.com/', url: 'https://sub.example.com/page' },
            // `www.*` describes the hosts under `www.`.
            { domain: 'www.*', url: 'https://www.example.com/' },
            { domain: 'www.*', url: 'https://www.a/' },
        ];

        it.each(cases)('matches $url for $domain', ({ domain, url }) => {
            expect(createEngine(domain).matchFrame(url)).not.toBeNull();
        });
    });

    describe('does not match any other document', () => {
        const cases = [
            // A plain entry covers neither subdomains nor hosts that only start with it.
            { domain: 'example.com', url: 'https://sub.example.com/' },
            { domain: 'example.com', url: 'https://example.community/' },
            { domain: 'example.com', url: 'https://example.com.evil.org/' },
            { domain: 'example.com', url: 'https://evil.org/' },
            // The domain must be the URL host, not a part of the path or the query.
            { domain: 'example.com', url: 'https://evil.org//example.com/' },
            { domain: 'example.com', url: 'https://evil.org/?url=//example.com/' },
            // A userinfo form only looks like the domain, the document host is the one after `@`.
            { domain: 'example.com', url: 'https://example.com@evil.org/' },
            { domain: 'example.com', url: 'https://example.com:80@evil.org/' },
            { domain: 'example.com', url: 'https://example.com:8080@evil.org/' },
            { domain: 'example.com', url: 'https://example.com:80@evil.org/' },
            // An entry with a metacharacter stays a literal host and cannot match another one.
            { domain: 'example(+).com', url: 'https://example.com/' },
            { domain: 'example.com(', url: 'https://example.com/' },
            { domain: 'exa+ple.com', url: 'https://exaple.com/' },
            { domain: 'example.com$', url: 'https://example.com/' },
            { domain: 'example.com', url: 'https://evil.org\\@example.com/' },
            { domain: '*.example.com', url: 'https://sub.example.community/' },
            { domain: '*.example.com', url: 'https://example.com.evil.org/' },
            { domain: '*example.com', url: 'https://myexample.community/' },
            // A wildcard stays within the host: it cannot reach the userinfo or the path.
            { domain: 'example.*', url: 'https://example.com@evil.org/' },
            { domain: '*.example.*', url: 'https://example.com@evil.org/' },
            { domain: '*.example.*', url: 'https://evil.org//example.com/' },
            { domain: '*.example.*', url: 'https://evil.org/?url=//example.com/' },
            { domain: '*.sub.example.*', url: 'https://sub.example.com@evil.org/' },
            { domain: '*example.com', url: 'https://evil.org//example.com/' },
            { domain: '*example.com', url: 'https://user@evil.org/?x=example.com' },
            // The `*.` twin added by MV3 reaches the same branch, so it is covered by the same rows.
            { domain: '*.example.com', url: 'https://example.com@evil.org/' },
            // A short domain keeps its host boundary as well.
            { domain: 't.me', url: 'https://evil.org//t.me/' },
            { domain: '*.a', url: 'https://evil.org//a/' },
            // `www.*` covers the hosts under `www.`, not the bare domain.
            { domain: 'www.*', url: 'https://example.com/' },
        ];

        it.each(cases)('does not match $url for $domain', ({ domain, url }) => {
            expect(createEngine(domain).matchFrame(url)).toBeNull();
        });
    });
});
