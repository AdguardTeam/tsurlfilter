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

    it('applies a domain exclusion per pair while an unsafe unrelated blocker stays untouched', () => {
        const rules = createRules(
            "$csp=script-src 'none'",
            "$csp=script-src 'none',script",
            "@@||example.com^$csp=script-src 'none'",
        );

        expect(CspRulesResolver.resolve(rules)).toEqual({
            rules: [rules[0], rules[1]],
            excludedRequestDomains: new Map([[rules[0], ['example.com']]]),
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
});
