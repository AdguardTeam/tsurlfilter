import { describe, expect, test } from 'vitest';

import { isAbpSnippetRule, isAdgScriptletRule, isUboScriptletRule } from '@adguard/scriptlets/validators';

import { defaultParserOptions, RuleParser } from '../../src/compat/rule-parser';
import { CosmeticRuleType, RuleCategory } from '../../src/nodes';

/**
 * Mirrors the options that `@adguard/scriptlets` v2.x passes to the shim in its
 * `getRuleNode` helper: `includeRaws: false`, `isLocIncluded: false`.
 */
const SCRIPTLETS_OPTIONS = {
    ...defaultParserOptions,
    includeRaws: false,
    isLocIncluded: false,
};

/**
 * Compatibility checks of the legacy `RuleParser` shim against the real
 * `@adguard/scriptlets` v2.5.1 validators. These run the compiled scriptlets
 * predicates against shim-parsed nodes, which is the exact cross-package path
 * the shim exists to keep working.
 */
describe('RuleParser shim vs @adguard/scriptlets v2 validators', () => {
    test('parses scriptlet rules into v5 nodes with string-compatible category and type', () => {
        const adg = RuleParser.parse(
            'example.org#%#//scriptlet("abort-on-property-read", "alert")',
            SCRIPTLETS_OPTIONS,
        );
        expect(adg.category).toBe(RuleCategory.Cosmetic);
        expect(adg.type).toBe(CosmeticRuleType.ScriptletInjectionRule);

        const ubo = RuleParser.parse(
            'example.com##+js(set, atob, noopFunc)',
            SCRIPTLETS_OPTIONS,
        );
        expect(ubo.category).toBe(RuleCategory.Cosmetic);
        expect(ubo.type).toBe(CosmeticRuleType.ScriptletInjectionRule);

        const abp = RuleParser.parse(
            'example.org#$#abort-on-property-read alert',
            SCRIPTLETS_OPTIONS,
        );
        expect(abp.category).toBe(RuleCategory.Cosmetic);
        expect(abp.type).toBe(CosmeticRuleType.ScriptletInjectionRule);
    });

    test('documents the numeric SyntaxFlags vs string AdblockSyntax gap', () => {
        // The shim returns AGTree v5 nodes, whose `syntax` is a numeric
        // `SyntaxFlags` bitmask. `@adguard/scriptlets` v2.x compares
        // `rule.syntax` to the string `AdblockSyntax` enum, so these public
        // predicates return false for every shim-parsed rule. Flip these
        // assertions to `true` once scriptlets ships a v5-compatible release
        // (or the shim starts emulating the legacy string syntax).
        // Note: scriptlets v2.5.1 types these predicates as `(rule: string)`,
        // but at runtime they also accept a pre-parsed node, so the node is
        // passed through an `unknown` cast to satisfy the cross-package type
        // mismatch.
        const adg = RuleParser.parse(
            'example.org#%#//scriptlet("abort-on-property-read", "alert")',
            SCRIPTLETS_OPTIONS,
        );
        expect(isAdgScriptletRule(adg as unknown as string)).toBe(false);

        const ubo = RuleParser.parse(
            'example.com##+js(set, atob, noopFunc)',
            SCRIPTLETS_OPTIONS,
        );
        expect(isUboScriptletRule(ubo as unknown as string)).toBe(false);

        const abp = RuleParser.parse(
            'example.org#$#abort-on-property-read alert',
            SCRIPTLETS_OPTIONS,
        );
        expect(isAbpSnippetRule(abp as unknown as string)).toBe(false);
    });
});
