import { describe, expect, it } from 'vitest';

import { Rule } from '../../../src/rule/rule';
import { CspRulesResolver } from '../../../src/rule-converters/csp-rules-resolver';

/**
 * Creates rules from their text.
 *
 * @param rulesText Rule texts.
 *
 * @returns Parsed rules.
 */
function createRules(...rulesText: string[]): Rule[] {
    return rulesText.flatMap((ruleText, index) => Rule.createFromText(1, index, ruleText));
}

describe('CspRulesResolver.resolve', () => {
    it('resolves an exception with the same condition and value', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none'",
            "@@||example.com^$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('resolves an empty exception with the same condition', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none'",
            "||example.com^$csp=img-src 'none'",
            '@@||example.com^$csp',
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('resolves identical path conditions', () => {
        const rules = createRules(
            "||example.com/path$csp=script-src 'none'",
            "@@||example.com/path$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('resolves identical exact URL conditions', () => {
        const rules = createRules(
            "|https://example.com/path|$csp=script-src 'none'",
            "@@|https://example.com/path|$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('resolves identical regular expression conditions', () => {
        const rules = createRules(
            String.raw`/^https:\/\/example\.com\//$csp=script-src 'none'`,
            String.raw`@@/^https:\/\/example\.com\//$csp=script-src 'none'`,
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('resolves equivalent conditions with reordered values', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',script,stylesheet",
            "@@||example.com^$csp=script-src 'none',stylesheet,script",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('rejects an exception with a different condition', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none'",
            "@@||example.com/path$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [rules[1]],
        });
    });

    it('does not let a regular exception override an important rule', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',important",
            "@@||example.com^$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('accepts an exception for a different CSP value as a safe no-op', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none'",
            "@@||example.com/path$csp=img-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('excludes a clean domain from a global blocking rule', () => {
        const rules = createRules(
            "$csp=script-src 'none'",
            "@@||cdn.example.com^$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map([[rules[0], ['cdn.example.com']]]),
            unsupportedExceptions: [],
        });
    });

    it('excludes a clean subdomain from a domain blocking rule', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none'",
            "@@||cdn.example.com^$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map([[rules[0], ['cdn.example.com']]]),
            unsupportedExceptions: [],
        });
    });

    it('excludes a clean subdomain from an anchored path rule', () => {
        const rules = createRules(
            "||example.com/path$csp=script-src 'none'",
            "@@||cdn.example.com^$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map([[rules[0], ['cdn.example.com']]]),
            unsupportedExceptions: [],
        });
    });

    it('removes a subdomain rule covered by a parent-domain exception', () => {
        const rules = createRules(
            "||cdn.example.com^$csp=script-src 'none'",
            "@@||example.com^$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('removes a path rule covered by a domain exception', () => {
        const rules = createRules(
            "||example.com/path$csp=script-src 'none'",
            "@@||example.com^$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('excludes a domain from an unterminated blocking pattern instead of cancelling', () => {
        const rules = createRules(
            "||example.com$csp=script-src 'none'",
            "@@||example.com^$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map([[rules[0], ['example.com']]]),
            unsupportedExceptions: [],
        });
    });

    it('accepts an exception on a disjoint domain as a safe no-op', () => {
        const rules = createRules(
            "||example.net^$csp=script-src 'none'",
            "@@||example.com^$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('rejects a domain exception containing a port', () => {
        const rules = createRules(
            "$csp=script-src 'none'",
            "@@||example.com:8080^$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [rules[1]],
        });
    });

    it('rejects an action-bearing modifier on an exception', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none'",
            "@@||example.com^$csp=script-src 'none',redirect=noopjs",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [rules[1]],
        });
    });

    it('rejects an exception with an unrepresentable domain condition', () => {
        const rules = createRules(
            "$csp=script-src 'none'",
            "@@||example.com^$csp=script-src 'none',domain=/foo\\.example/",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [rules[1]],
        });
    });

    it('accepts an exception with a disjoint $domain condition as a safe no-op', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',domain=foo.com",
            "@@||example.com^$csp=script-src 'none',domain=bar.com",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('cancels a blocker whose $domain differs in case only', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',domain=foo.com",
            "@@||example.com^$csp=script-src 'none',domain=FOO.COM",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('cancels a blocker whose uppercase $domain differs in case only', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',domain=FOO.COM",
            "@@||example.com^$csp=script-src 'none',domain=foo.com",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('reports a narrower $domain exception written in a different case', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',domain=foo.com",
            "@@||example.com^$csp=script-src 'none',domain=SUB.FOO.COM",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [rules[1]],
        });
    });

    it('cancels a blocker whose $to differs in case only', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',to=cdn.example.com",
            "@@||example.com^$csp=script-src 'none',to=CDN.EXAMPLE.COM",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('lets an unrestricted exception cancel a blocker restricted by $domain', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',domain=foo.com",
            "@@||example.com^$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('lets a parent $domain exception cancel a subdomain-restricted blocker', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',domain=sub.foo.com",
            "@@||example.com^$csp=script-src 'none',domain=foo.com",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('excludes a clean domain from a blocker restricted by a $domain list', () => {
        const rules = createRules(
            "$csp=script-src 'none',domain=foo.com|bar.com",
            "@@||bar.com^$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map([[rules[0], ['bar.com']]]),
            unsupportedExceptions: [],
        });
    });

    it('rejects an exception narrower than an unrestricted blocker by $domain', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none'",
            "@@||example.com^$csp=script-src 'none',domain=foo.com",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [rules[1]],
        });
    });

    it('lets an unrestricted exception cancel a blocker with an excluded $domain', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',domain=~foo.com",
            "@@||example.com^$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('lets an exception exclude fewer domains than the blocker', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',domain=~foo.com|~bar.com",
            "@@||example.com^$csp=script-src 'none',domain=~foo.com",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('lets an exception exclude a subdomain of the blocker excluded domain', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',domain=~foo.com",
            "@@||example.com^$csp=script-src 'none',domain=~sub.foo.com",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('rejects an exception excluding a domain the blocker does not exclude', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',domain=~foo.com",
            "@@||example.com^$csp=script-src 'none',domain=~bar.com",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [rules[1]],
        });
    });

    it('rejects an exception excluding more domains than the blocker', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',domain=~foo.com",
            "@@||example.com^$csp=script-src 'none',domain=~foo.com|~bar.com",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [rules[1]],
        });
    });

    it('rejects an exception excluding a domain while the blocker excludes nothing', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none'",
            "@@||example.com^$csp=script-src 'none',domain=~foo.com",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [rules[1]],
        });
    });

    it('rejects an exception excluding a parent of the blocker excluded domain', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',domain=~sub.foo.com",
            "@@||example.com^$csp=script-src 'none',domain=~foo.com",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [rules[1]],
        });
    });

    it('lets an unrestricted exception cancel a blocker restricted by both $domain lists', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',domain=foo.com|~bar.com",
            "@@||example.com^$csp=script-src 'none',domain=foo.com",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('rejects an exception adding an exclusion to the blocker $domain', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',domain=foo.com",
            "@@||example.com^$csp=script-src 'none',domain=foo.com|~bar.com",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [rules[1]],
        });
    });

    it('excludes a clean domain from a blocker with an excluded $domain', () => {
        const rules = createRules(
            "$csp=script-src 'none',domain=~foo.com",
            "@@||bar.com^$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map([[rules[0], ['bar.com']]]),
            unsupportedExceptions: [],
        });
    });

    it('rejects a clean domain exception excluding a domain the blocker does not exclude', () => {
        const rules = createRules(
            "$csp=script-src 'none',domain=~foo.com",
            "@@||bar.com^$csp=script-src 'none',domain=~baz.com",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [rules[1]],
        });
    });

    it('lets an unrestricted exception cancel a blocker with a $header condition', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',header=x-custom-header",
            "@@||example.com^$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('lets a header exception cancel a blocker with the same header', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',header=x-custom-header",
            "@@||example.com^$csp=script-src 'none',header=x-custom-header",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('lets a header exception cancel a blocker with a header value restriction', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',header=set-cookie:/a/",
            "@@||example.com^$csp=script-src 'none',header=set-cookie",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('rejects an exception restricted by a $header the blocker does not have', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none'",
            "@@||example.com^$csp=script-src 'none',header=x-custom-header",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [rules[1]],
        });
    });

    it('applies an exact exception to its matching blocker while keeping an unrelated global blocker', () => {
        const rules = createRules(
            "|https://example.com/path|$csp=script-src 'none'",
            "$csp=script-src 'none'",
            "@@|https://example.com/path|$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[1]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('applies a domain exclusion to every blocker the exception covers', () => {
        const rules = createRules(
            "$csp=script-src 'none'",
            "$csp=script-src 'none',script",
            "@@||example.com^$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0], rules[1]],
            excludedRequestDomains: new Map([
                [rules[0], ['example.com']],
                [rules[1], ['example.com']],
            ]),
            unsupportedExceptions: [],
        });
    });

    it('reports an exception as unsupported only when no pair can apply it', () => {
        const rules = createRules(
            "$csp=script-src 'none'",
            "||example.com^$csp=script-src 'none'",
            "@@||example.com/path$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0], rules[1]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [rules[2]],
        });
    });

    it('lets a narrower denyallow exception cancel a global blocker it covers', () => {
        const rules = createRules(
            "$csp=script-src 'none',denyallow=example.com|cdn.example.com",
            "@@$csp=script-src 'none',denyallow=example.com",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('keeps a global blocker when a denyallow exception does not cover it', () => {
        const rules = createRules(
            "$csp=script-src 'none',denyallow=example.com",
            "@@$csp=script-src 'none',denyallow=example.com|other.com",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [rules[1]],
        });
    });

    it('lets a denyallow exception excluding a subdomain cancel a global blocker', () => {
        const rules = createRules(
            "$csp=script-src 'none',denyallow=example.com",
            "@@$csp=script-src 'none',denyallow=sub.example.com",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('cancels a global blocker whose $denyallow differs in case only', () => {
        const rules = createRules(
            "$csp=script-src 'none',denyallow=example.com",
            "@@$csp=script-src 'none',denyallow=EXAMPLE.COM",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('lets a pattern-less exception cancel a URL-scoped blocker', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none'",
            "@@$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('keeps a URL-scoped blocker when a pattern-less exception is narrower by $domain', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none'",
            "@@$csp=script-src 'none',domain=foo.com",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [rules[1]],
        });
    });

    it('lets a `*`-only exception cancel a URL-scoped blocker', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none'",
            '@@*$csp',
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('keeps a blocker when a `*`-only exception has a different value', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none'",
            "@@*$csp=img-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('keeps a case-sensitive blocker when a $match-case exception cannot match the host', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',match-case",
            '@@||EXAMPLE.COM^$csp,match-case',
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('cancels a case-sensitive blocker with a matching $match-case exception', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',match-case",
            '@@||example.com^$csp,match-case',
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('does not exclude a domain a $match-case exception cannot match', () => {
        const rules = createRules(
            "$csp=script-src 'none',match-case",
            '@@||EXAMPLE.COM^$csp,match-case',
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('cancels a blocker narrowed by $domain with a wider exception', () => {
        const rules = createRules(
            "|https://example.com/path|$csp=script-src 'none',domain=foo.com",
            "@@|https://example.com/path|$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('cancels a blocker narrowed by $header with a wider exception', () => {
        const rules = createRules(
            "||example.com/path$csp=script-src 'none',header=set-cookie",
            "@@||example.com/path$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('cancels a blocker whose $header differs in case only', () => {
        const rules = createRules(
            "||example.com/path$csp=script-src 'none',header=set-cookie",
            "@@||example.com/path$csp=script-src 'none',header=Set-Cookie",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('keeps a blocker when the exception is narrower', () => {
        const rules = createRules(
            "||example.com/path$csp=script-src 'none'",
            "@@||example.com/path$csp=script-src 'none',domain=foo.com",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [rules[1]],
        });
    });

    it('cancels a $third-party blocker with an exception without party restriction', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',third-party",
            '@@||example.com^$csp',
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('cancels a resource-type blocker with an exception without type restriction', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',subdocument",
            '@@||example.com^$csp',
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('cancels a method blocker with an exception without method restriction', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',method=post",
            '@@||example.com^$csp',
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('cancels a $match-case blocker with a case-insensitive exception', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',match-case",
            '@@||example.com^$csp',
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });

    it('keeps a blocker when the exception adds a party restriction', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none'",
            '@@||example.com^$csp,third-party',
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [rules[1]],
        });
    });

    it('keeps a subdocument blocker when the exception excludes subdocuments', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',subdocument",
            '@@||example.com^$csp,~subdocument',
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [rules[1]],
        });
    });

    it('keeps a blocker when the exception excludes more resource types', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',~subdocument",
            '@@||example.com^$csp,~subdocument,~script',
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0]],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [rules[1]],
        });
    });

    it('cancels an excluded-resource-type blocker with an unrestricted exception', () => {
        const rules = createRules(
            "||example.com^$csp=script-src 'none',~subdocument",
            '@@||example.com^$csp',
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [],
            excludedRequestDomains: new Map(),
            unsupportedExceptions: [],
        });
    });
});
