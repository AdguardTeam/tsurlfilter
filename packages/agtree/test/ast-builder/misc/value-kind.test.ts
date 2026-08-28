import { describe, expect, test } from 'vitest';

import { RuleParserPipeline } from '../../../src/ast-builder/rule-parser';
import type { NetworkRule } from '../../../src/nodes';
import { ValueKind } from '../../../src/nodes';

const parser = new RuleParserPipeline();

describe('Value/Raw kind on network rules', () => {
    test('regex pattern has kind Regex', () => {
        const ast = parser.parse('/banner\\d+/') as NetworkRule;
        expect(ast.pattern.kind).toBe(ValueKind.Regex);
    });

    test('plain pattern has kind Pattern', () => {
        const ast = parser.parse('||example.com^') as NetworkRule;
        expect(ast.pattern.kind).toBe(ValueKind.Pattern);
    });

    test('domain modifier value has kind DomainList and type Raw', () => {
        const ast = parser.parse('||example.com^$domain=a.com|~b.net') as NetworkRule;
        const domainMod = ast.modifiers!.children.find((m) => m.name.value === 'domain');
        expect(domainMod!.value!.type).toBe('Raw');
        expect(domainMod!.value!.kind).toBe(ValueKind.DomainList);
    });

    test('csp modifier value has kind Csp and type Raw', () => {
        const ast = parser.parse("||example.com^$csp=script-src 'self'") as NetworkRule;
        const cspMod = ast.modifiers!.children.find((m) => m.name.value === 'csp');
        expect(cspMod!.value!.type).toBe('Raw');
        expect(cspMod!.value!.kind).toBe(ValueKind.Csp);
    });

    test('redirect modifier value has kind Resource and type Value', () => {
        const ast = parser.parse('||example.com^$redirect=nooptext') as NetworkRule;
        const rMod = ast.modifiers!.children.find((m) => m.name.value === 'redirect');
        expect(rMod!.value!.type).toBe('Value');
        expect(rMod!.value!.kind).toBe(ValueKind.Resource);
    });

    test('removeparam with regex has kind Regex and type Value', () => {
        const ast = parser.parse('||example.com^$removeparam=/tracking/i') as NetworkRule;
        const rpMod = ast.modifiers!.children.find((m) => m.name.value === 'removeparam');
        expect(rpMod!.value!.type).toBe('Value');
        expect(rpMod!.value!.kind).toBe(ValueKind.Regex);
    });

    test('modifier name has kind Identifier', () => {
        const ast = parser.parse('||example.com^$script') as NetworkRule;
        expect(ast.modifiers!.children[0].name.kind).toBe(ValueKind.Identifier);
    });

    test('unknown modifier value has no kind', () => {
        const ast = parser.parse('||example.com^$method=get') as NetworkRule;
        const mod = ast.modifiers!.children[0];
        expect(mod.value!.kind).toBeUndefined();
    });
});
