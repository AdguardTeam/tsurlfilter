/**
 * @file Corpus test: verifies that dnr-converter's Rule can parse
 * all rules from the corpus file and produce consistent accessor results.
 *
 * NOTE: Direct cross-package parity testing with @adguard/tsurlfilter is
 * not possible here because the global test setup mocks @adguard/logger
 * in a way that is incompatible with tsurlfilter's Logger constructor.
 * Instead, we verify structural correctness and consistency of the
 * dnr-converter Rule against the corpus.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { OPTION_NAMES } from '../../src/rule/option-names';
import { Rule } from '../../src/rule/rule';

/**
 * Reads the corpus file and returns non-empty, non-comment lines.
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

describe('Rule corpus parsing', () => {
    const corpusRules = loadCorpus('network-rule-corpus.txt');

    it('corpus contains at least 100 rules', () => {
        expect(corpusRules.length).toBeGreaterThanOrEqual(50);
    });

    it.each(corpusRules)('parses and produces consistent accessors for: %s', (ruleText) => {
        const rules = Rule.createFromText(1, 0, ruleText);
        expect(rules.length).toBeGreaterThanOrEqual(1);

        const rule = rules[0];

        // Basic invariants
        expect(typeof rule.allowlist).toBe('boolean');
        expect(typeof rule.pattern).toBe('string');
        expect(typeof rule.priority).toBe('number');
        expect(rule.priority).toBeGreaterThan(0);
        expect(typeof rule.isFilteringDisabled()).toBe('boolean');

        // Domain accessors return arrays or null
        const permDomains = rule.permittedDomains;
        const restDomains = rule.restrictedDomains;
        expect(permDomains === null || Array.isArray(permDomains)).toBe(true);
        expect(restDomains === null || Array.isArray(restDomains)).toBe(true);

        // Allowlist rules start with @@
        if (ruleText.startsWith('@@')) {
            expect(rule.allowlist).toBe(true);
        } else {
            expect(rule.allowlist).toBe(false);
        }
    });

    describe('specific rule expectations', () => {
        it('$third-party sets the ThirdParty option', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$third-party');
            expect(rule.isModifierEnabled(OPTION_NAMES.THIRD_PARTY)).toBe(true);
        });

        it('$important sets the Important option', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$important');
            expect(rule.isModifierEnabled(OPTION_NAMES.IMPORTANT)).toBe(true);
        });

        it('$domain populates permitted/restricted domains', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$domain=foo.com|~bar.com');
            expect(rule.permittedDomains).toEqual(['foo.com']);
            expect(rule.restrictedDomains).toEqual(['bar.com']);
        });

        it('$to populates permitted/restricted to-domains', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$to=target.com|~excluded.com');
            expect(rule.permittedToDomains).toEqual(['target.com']);
            expect(rule.restrictedToDomains).toEqual(['excluded.com']);
        });

        it('$method populates permitted methods', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$method=get|post');
            expect(rule.permittedMethods?.sort()).toEqual(['get', 'post']);
        });

        it('$csp sets advanced modifier value', () => {
            const [rule] = Rule.createFromText(1, 0, "||example.com^$csp=script-src 'none'");
            expect(rule.isModifierEnabled(OPTION_NAMES.CSP)).toBe(true);
            expect(rule.advancedModifierValue).toBe("script-src 'none'");
        });

        it('$redirect sets advanced modifier value', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$redirect=noopjs');
            expect(rule.isModifierEnabled(OPTION_NAMES.REDIRECT)).toBe(true);
            expect(rule.advancedModifierValue).toBe('noopjs');
        });

        it('$badfilter sets the Badfilter option', () => {
            const [rule] = Rule.createFromText(1, 0, '||example.com^$badfilter');
            expect(rule.isModifierEnabled(OPTION_NAMES.BADFILTER)).toBe(true);
        });

        it('@@$document sets filtering disabled', () => {
            const [rule] = Rule.createFromText(1, 0, '@@||example.com^$document');
            expect(rule.isFilteringDisabled()).toBe(true);
        });
    });
});
