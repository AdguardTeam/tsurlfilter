import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../../src/ast-builder/rule-parser';
import type { Parameter, ScriptletInjectionRule } from '../../../src/nodes';

/**
 * Exceeds the default capacity (128 Int32 slots / 2 = 64 usable param slots).
 */
const PARAMS_ABOVE_DEFAULT = 80;

/**
 * Size used for sequential-pass reuse tests.
 */
const PARAMS_SEQUENTIAL = 70;

/**
 * Build an ADG scriptlet rule with N quoted params (name + N-1 args).
 *
 * @param n Total number of parameters (including the scriptlet name).
 *
 * @returns Rule source string.
 */
function makeAdgScriptlet(n: number): string {
    const params = Array.from({ length: n }, (_, i) => `'p${i}'`).join(', ');
    return `example.com#%#//scriptlet(${params})`;
}

describe('Scriptlet-body growth', () => {
    test('parses ADG scriptlet with more params than default capacity (128/2=64)', () => {
        const parser = new RuleParserPipeline();
        const n = PARAMS_ABOVE_DEFAULT;
        const rule = parser.parse(makeAdgScriptlet(n)) as ScriptletInjectionRule;

        expect(rule.type).toBe('ScriptletInjectionRule');
        expect(rule.body.children).toHaveLength(1);

        const call = rule.body.children[0];
        expect(call.children).toHaveLength(n);

        // First param is the scriptlet name, last is p(n-1)
        expect((call.children[0] as Parameter).value).toBe('p0');
        expect((call.children[n - 1] as Parameter).value).toBe(`p${n - 1}`);
    });

    test('parses multiple large scriptlet rules in sequence', () => {
        const parser = new RuleParserPipeline();
        for (let pass = 0; pass < 3; pass += 1) {
            const n = PARAMS_SEQUENTIAL;
            const rule = parser.parse(makeAdgScriptlet(n)) as ScriptletInjectionRule;
            expect(rule.body.children[0].children).toHaveLength(n);
        }
    });
});
