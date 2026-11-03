import { describe, expect, it } from 'vitest';

import { Engine } from '../../src/engine/engine';
import { RuleFactory } from '../../src/rules/rule-factory';

/**
 * Filter list id used for the generated allowlist rules.
 */
const FILTER_LIST_ID = 100;

/**
 * Beginning of the rule generated for an entry without the `*.` prefix: the URL start, which
 * makes the domain match the URL host, the optional credentials and the optional `www.` subdomain.
 */
const RULE_START = String.raw`@@/^(?:https?|wss?)://(?:[^/\\?#]*@)?(www\.)?`;

/**
 * End of the rule generated for an entry without the `*.` prefix: the host end — an optional root
 * label dot, an optional port, the path, the query, the fragment or the end of the URL — and the
 * modifiers.
 */
const RULE_END = String.raw`(?:\.)?(?::\d*)?(?:[/\\?#]|$)/$document,important`;

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

describe('RuleFactory.createAllowlistRule', () => {
    describe('generates a rule for a domain entry', () => {
        const cases = [
            { domain: 'example.com', expected: `${RULE_START}example\\.com${RULE_END}` },
            { domain: 'www.example.com', expected: `${RULE_START}example\\.com${RULE_END}` },
            { domain: 'EXAMPLE.COM', expected: `${RULE_START}example\\.com${RULE_END}` },
            { domain: 'sub.example.com', expected: `${RULE_START}sub\\.example\\.com${RULE_END}` },
            { domain: 'example.*', expected: `${RULE_START}example\\..*${RULE_END}` },
            { domain: '*example.*', expected: `${RULE_START}.*example\\..*${RULE_END}` },
            { domain: '*example.com', expected: `${RULE_START}.*example\\.com${RULE_END}` },
            // Regexp metacharacters of the entry are escaped, so the entry stays a literal host.
            { domain: 'example(+).com', expected: `${RULE_START}example\\(\\+\\)\\.com${RULE_END}` },
            { domain: '*.example.com', expected: String.raw`@@||example.com^$document,important` },
            { domain: '*.EXAMPLE.COM', expected: String.raw`@@||example.com^$document,important` },
            { domain: '*.sub.example.*', expected: String.raw`@@||sub.example.*^$document,important` },
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
            { domain: '*.example.com', url: 'https://example.com./' },
            { domain: 'example.*', url: 'https://example.org/' },
            // A wildcard TLD entry matches any TLD, so this host is covered by design.
            { domain: 'example.*', url: 'https://example.community/' },
            { domain: '*example.com', url: 'https://myexample.com/' },
            { domain: '*.*', url: 'https://a.com/' },
            { domain: '*.*', url: 'https://example.com.community/' },
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
        ];

        it.each(cases)('does not match $url for $domain', ({ domain, url }) => {
            expect(createEngine(domain).matchFrame(url)).toBeNull();
        });
    });
});
