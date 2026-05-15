/**
 * @file Tests for RuleDeclarativeValidator — verifies that the validator
 * correctly accepts/rejects rules for DNR conversion.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { Rule } from '../../src/rule/rule';
import { RuleDeclarativeValidator } from '../../src/rule/rule-validator';

/**
 * Reads a corpus file and returns non-empty, non-comment lines.
 *
 * @param filename Fixture file name.
 *
 * @returns Array of rule text strings.
 */
function loadCorpus(filename: string): string[] {
    const filePath = resolve(__dirname, '..', 'fixtures', filename);
    const content = readFileSync(filePath, 'utf-8');
    return content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('!'));
}

describe('RuleDeclarativeValidator', () => {
    describe('shouldConvertRule — supported modifiers', () => {
        it('accepts a basic blocking rule', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^');
            expect(RuleDeclarativeValidator.shouldConvertRule(rule)).toBe(true);
        });

        it('accepts $third-party rule', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$third-party');
            expect(RuleDeclarativeValidator.shouldConvertRule(rule)).toBe(true);
        });

        it('accepts $important rule', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$important');
            expect(RuleDeclarativeValidator.shouldConvertRule(rule)).toBe(true);
        });

        it('accepts $domain rule', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com');
            expect(RuleDeclarativeValidator.shouldConvertRule(rule)).toBe(true);
        });

        it('accepts $to rule', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$to=target.com');
            expect(RuleDeclarativeValidator.shouldConvertRule(rule)).toBe(true);
        });

        it('accepts $method=get rule', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$method=get');
            expect(RuleDeclarativeValidator.shouldConvertRule(rule)).toBe(true);
        });

        it('accepts $removeparam with simple value', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$removeparam=utm_source');
            expect(RuleDeclarativeValidator.shouldConvertRule(rule)).toBe(true);
        });

        it('accepts $removeheader with valid header', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$removeheader=refresh');
            expect(RuleDeclarativeValidator.shouldConvertRule(rule)).toBe(true);
        });

        it('accepts $csp on blocking rule', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$csp=script-src \'none\'');
            expect(RuleDeclarativeValidator.shouldConvertRule(rule)).toBe(true);
        });

        it('accepts $redirect on blocking rule', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$redirect=noopjs');
            expect(RuleDeclarativeValidator.shouldConvertRule(rule)).toBe(true);
        });

        it('accepts $cookie without parameters', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$cookie');
            expect(RuleDeclarativeValidator.shouldConvertRule(rule)).toBe(true);
        });

        it('accepts $permissions rule', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$permissions=camera=()');
            expect(RuleDeclarativeValidator.shouldConvertRule(rule)).toBe(true);
        });

        it('accepts $badfilter rule', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$badfilter');
            expect(RuleDeclarativeValidator.shouldConvertRule(rule)).toBe(true);
        });
    });

    describe('shouldConvertRule — skip conversion', () => {
        it('returns false for $elemhide-only rule', () => {
            const [rule] = Rule.createFromText(1, 0, '@@||example.com^$elemhide');
            expect(RuleDeclarativeValidator.shouldConvertRule(rule)).toBe(false);
        });

        it('returns false for $generichide-only rule', () => {
            const [rule] = Rule.createFromText(1, 0, '@@||example.com^$generichide');
            expect(RuleDeclarativeValidator.shouldConvertRule(rule)).toBe(false);
        });

        it('returns false for $specifichide-only rule', () => {
            const [rule] = Rule.createFromText(1, 0, '@@||example.com^$specifichide');
            expect(RuleDeclarativeValidator.shouldConvertRule(rule)).toBe(false);
        });
    });

    describe('shouldConvertRule — unsupported modifiers', () => {
        it('throws for $replace modifier', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$replace=/ad/blocked/');
            expect(() => RuleDeclarativeValidator.shouldConvertRule(rule)).toThrow();
        });

        it('throws for $jsonprune modifier', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$jsonprune=\\$.ads');
            expect(() => RuleDeclarativeValidator.shouldConvertRule(rule)).toThrow();
        });

        it('throws for $hls modifier', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$hls=/#EXTINF.+?broll/');
            expect(() => RuleDeclarativeValidator.shouldConvertRule(rule)).toThrow();
        });

        it('throws for $stealth modifier', () => {
            const [rule] = Rule.createFromText(1, 0, '@@||example.com^$stealth');
            expect(() => RuleDeclarativeValidator.shouldConvertRule(rule)).toThrow();
        });

        it('throws for $genericblock modifier', () => {
            const [rule] = Rule.createFromText(1, 0, '@@||example.com^$genericblock');
            expect(() => RuleDeclarativeValidator.shouldConvertRule(rule)).toThrow();
        });

        it('throws for $network modifier', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$network');
            expect(() => RuleDeclarativeValidator.shouldConvertRule(rule)).toThrow();
        });
    });

    describe('shouldConvertRule — partial support (custom checks)', () => {
        it('throws for allowlist $csp rule', () => {
            const [rule] = Rule.createFromText(1, 0, '@@||example.com^$csp');
            expect(() => RuleDeclarativeValidator.shouldConvertRule(rule)).toThrow();
        });

        it('throws for allowlist $redirect rule', () => {
            const [rule] = Rule.createFromText(1, 0, '@@||example.com^$redirect=noopjs');
            expect(() => RuleDeclarativeValidator.shouldConvertRule(rule)).toThrow();
        });

        it('throws for allowlist $removeparam rule', () => {
            const [rule] = Rule.createFromText(1, 0, '@@||example.com^$removeparam');
            expect(() => RuleDeclarativeValidator.shouldConvertRule(rule)).toThrow();
        });

        it('throws for allowlist $removeheader rule', () => {
            const [rule] = Rule.createFromText(1, 0, '@@||example.com^$removeheader=refresh');
            expect(() => RuleDeclarativeValidator.shouldConvertRule(rule)).toThrow();
        });

        it('throws for allowlist $cookie rule', () => {
            const [rule] = Rule.createFromText(1, 0, '@@||example.com^$cookie');
            expect(() => RuleDeclarativeValidator.shouldConvertRule(rule)).toThrow();
        });

        it('throws for $removeparam with negation', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$removeparam=~utm_source');
            expect(() => RuleDeclarativeValidator.shouldConvertRule(rule)).toThrow();
        });

        it('throws for $removeparam with regex', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$removeparam=/^utm_/');
            expect(() => RuleDeclarativeValidator.shouldConvertRule(rule)).toThrow();
        });

        it('throws for $cookie with parameters', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$cookie=test;maxAge=3600');
            expect(() => RuleDeclarativeValidator.shouldConvertRule(rule)).toThrow();
        });

        it('throws for $method with trace', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$method=trace');
            expect(() => RuleDeclarativeValidator.shouldConvertRule(rule)).toThrow();
        });

        it('accepts $document allowlist rule (full filtering-disabled)', () => {
            const [rule] = Rule.createFromText(1, 0, '@@||example.com^$document');
            // $document sets elemhide+content+urlblock+jsinject, so isFilteringDisabled() = true
            // This should be accepted (checkDocumentAllowlistFn returns null)
            expect(RuleDeclarativeValidator.shouldConvertRule(rule)).toBe(true);
        });
    });

    describe('corpus-based validation', () => {
        const invalidRules = loadCorpus('network-rule-invalid-corpus.txt');

        it.each(invalidRules)('rejects invalid rule: %s', (ruleText) => {
            let rule;
            try {
                const rules = Rule.createFromText(1, 0, ruleText);
                if (rules.length === 0) {
                    // Rule was not parseable as a network rule — consider it "rejected"
                    return;
                }
                [rule] = rules;
            } catch {
                // Rule failed to parse — equivalent to rejection
                return;
            }

            // If the rule parsed successfully, the validator should reject it
            expect(() => RuleDeclarativeValidator.shouldConvertRule(rule)).toThrow();
        });
    });
});
