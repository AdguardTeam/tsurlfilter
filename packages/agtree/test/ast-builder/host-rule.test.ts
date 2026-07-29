import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { HostRuleAstBuilder } from '../../src/ast-builder/network/host-rule';
import { RuleParserPipeline } from '../../src/ast-builder/rule-parser';
import type { HostRule } from '../../src/nodes';

describe('RuleParserPipeline host rules', () => {
    const parser = new RuleParserPipeline();

    it('parses an IPv4 host rule when parseHostRules is enabled', () => {
        const node = parser.parse('127.0.0.1 example.com example.org', { parseHostRules: true }) as HostRule;
        expect(node.type).toBe('HostRule');
        expect(node.ip.value).toBe('127.0.0.1');
        expect(node.hostnames.children.map((h) => h.value)).toEqual(['example.com', 'example.org']);
    });

    it('parses the "just domain" host syntax with a null IP', () => {
        const node = parser.parse('example.org', { parseHostRules: true }) as HostRule;
        expect(node.type).toBe('HostRule');
        expect(node.ip.value).toBe('0.0.0.0');
        expect(node.hostnames.children.map((h) => h.value)).toEqual(['example.org']);
    });

    it('does NOT produce a host rule when parseHostRules is disabled', () => {
        const node = parser.parse('127.0.0.1 example.com', {}) as HostRule;
        expect(node.type).not.toBe('HostRule');
        expect(node.category).toBe('Network');
    });

    it('falls back to a network rule for non-host input even with parseHostRules', () => {
        const node = parser.parse('||example.org^$script', { parseHostRules: true }) as HostRule;
        expect(node.type).not.toBe('HostRule');
        expect(node.category).toBe('Network');
    });

    it('the candidate gate rejects a domain-like network rule without host-parsing it', () => {
        // `example.org^` has no `$` and starts with domain chars, but the `^`
        // token makes the gate reject it, so it stays a network rule.
        const node = parser.parse('example.org^', { parseHostRules: true }) as HostRule;
        expect(node.type).not.toBe('HostRule');
        expect(node.category).toBe('Network');
    });

    it('parses an IPv6 host rule', () => {
        const node = parser.parse('::1 localhost', { parseHostRules: true }) as HostRule;
        expect(node.type).toBe('HostRule');
        expect(node.ip.value).toBe('::1');
        expect(node.hostnames.children.map((h) => h.value)).toEqual(['localhost']);
    });

    it('parses a host rule with an inline comment and preserves raw comment text', () => {
        const node = parser.parse(
            '0.0.0.0 example.com # block this',
            { parseHostRules: true, isLocIncluded: true },
        ) as HostRule;
        expect(node.type).toBe('HostRule');
        expect(node.ip.value).toBe('0.0.0.0');
        expect(node.comment).toBeDefined();
        expect(node.comment!.value).toBe('# block this');
        // Comment start/end should be consistent with the stored value.
        expect(node.comment!.start).toBeGreaterThan(0);
        expect(node.comment!.end).toBeGreaterThan(node.comment!.start!);
    });

    it('returns null for a line with an IP but no hostname', () => {
        // `HostRuleAstBuilder.parse` returns null, so the pipeline falls back to
        // a network rule (which itself may be invalid).
        const node = parser.parse('127.0.0.1', { parseHostRules: true }) as HostRule;
        expect(node.type).not.toBe('HostRule');
    });

    it('does not touch the host gate or parser when parseHostRules is disabled', () => {
        const candidateSpy = vi.spyOn(HostRuleAstBuilder, 'isCandidate');
        const parseSpy = vi.spyOn(HostRuleAstBuilder, 'parse');

        // Both a host-shaped and a network rule, parsed with host parsing OFF.
        parser.parse('127.0.0.1 example.com', {});
        parser.parse('||example.org^$script', {});
        parser.parse('example.org'); // no options at all

        expect(candidateSpy).not.toHaveBeenCalled();
        expect(parseSpy).not.toHaveBeenCalled();

        candidateSpy.mockRestore();
        parseSpy.mockRestore();
    });
});
