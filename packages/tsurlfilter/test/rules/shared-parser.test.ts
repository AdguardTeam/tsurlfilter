/**
 * @file Tests for the single rule parser pipeline shared by all tsurlfilter
 * rule entry points (T-040(b), F-012, A08-C07).
 */

import { describe, expect, it } from 'vitest';

import { Engine } from '../../src/engine/engine';
import { CosmeticRule } from '../../src/rules/cosmetic-rule';
import { HostRule } from '../../src/rules/host-rule';
import { NetworkRule } from '../../src/rules/network-rule';
import { RuleFactory } from '../../src/rules/rule-factory';
import { sharedRuleParser } from '../../src/rules/shared-parser';

/**
 * Builds a network rule with `count` domains, close to the token cap.
 *
 * @param count Number of domains.
 *
 * @returns Rule text.
 */
const capRule = (count: number): string => `||example.org^$domain=${Array.from(
    { length: count },
    (_, i) => `d${i}.com`,
).join('|')}`;

/**
 * Token buffer capacity of the shared pipeline.
 *
 * @returns Capacity in tokens.
 */
const tokenCapacity = (): number => (sharedRuleParser as unknown as {
    tokenizer: { types: Uint8Array };
}).tokenizer.types.length;

/**
 * Source string currently retained by the shared pipeline.
 *
 * @returns Retained source.
 */
const retainedSource = (): string => (sharedRuleParser as unknown as {
    ctx: { source: string };
}).ctx.source;

describe('shared rule parser pipeline', () => {
    it('backs every rule entry point', () => {
        // Four separate pipelines each retained the peak buffers of the
        // largest rule they parsed; one instance retains one peak.
        expect((RuleFactory as unknown as { PARSER: unknown }).PARSER).toBe(sharedRuleParser);
        expect((NetworkRule as unknown as { PARSER: unknown }).PARSER).toBe(sharedRuleParser);
        expect((CosmeticRule as unknown as { PARSER: unknown }).PARSER).toBe(sharedRuleParser);
        expect((HostRule as unknown as { PARSER: unknown }).PARSER).toBe(sharedRuleParser);
    });

    it('Engine creation releases the buffers grown by a large rule', () => {
        const initialCapacity = tokenCapacity();

        expect(RuleFactory.createRule(capRule(52_000), 1)).toBeInstanceOf(NetworkRule);
        expect(tokenCapacity()).toBeGreaterThan(initialCapacity);
        expect(retainedSource().length).toBeGreaterThan(0);

        const engine = Engine.createSync({ filters: [{ id: 1, content: '||ads.example^\n' }] });

        expect(engine.getRulesCount()).toBe(1);
        expect(tokenCapacity()).toBe(initialCapacity);
        expect(retainedSource()).toBe('');
    });
});
