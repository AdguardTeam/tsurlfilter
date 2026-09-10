import { describe, expect, it } from 'vitest';

import {
    cloneAnyCommentRule,
    cloneAnyNetworkRule,
    cloneAnyCosmeticRule,
    cloneAnyRule,
    cloneDomainListNode,
    cloneModifierListNode,
    cloneScriptletRuleNode,
} from '../../src/ast-utils/clone';
import { HostRuleParser } from '../../src/parser/network/host-rule-parser';
import { RuleParser } from '../../src/parser/rule-parser';

// Helpers

/**
 * Parses a raw rule string and returns the AST node.
 * Throws if parsing results in an InvalidRule.
 */
function parse(raw: string) {
    const node = RuleParser.parse(raw);

    if (node.type === 'InvalidRule') {
        throw new Error(`Failed to parse rule: ${raw}`);
    }

    return node;
}

// Sub-node cloners

describe('cloneModifierListNode', () => {
    it('should return a deep copy, not the same reference', () => {
        const node = parse('||example.com^$script,domain=example.org');

        if (node.type !== 'NetworkRule' || !node.modifiers) {
            throw new Error('Expected a NetworkRule with modifiers');
        }

        const { modifiers } = node;
        const cloned = cloneModifierListNode(modifiers);

        expect(cloned).toEqual(modifiers);
        expect(cloned).not.toBe(modifiers);
        expect(cloned.children[0]).not.toBe(modifiers.children[0]);
        expect(cloned.children[0].name).not.toBe(modifiers.children[0].name);
    });

    it('should clone modifier values independently', () => {
        const node = parse('||example.com^$domain=example.org');

        if (node.type !== 'NetworkRule' || !node.modifiers) {
            throw new Error('Expected a NetworkRule with modifiers');
        }

        const { modifiers } = node;
        const cloned = cloneModifierListNode(modifiers);

        // Mutate the clone — original must stay unchanged
        cloned.children[0].name.value = 'mutated';

        expect(modifiers.children[0].name.value).toBe('domain');
    });
});

describe('cloneDomainListNode', () => {
    it('should return a deep copy of the domain list', () => {
        const node = parse('example.com,~example.org##.ad');

        if (node.type !== 'ElementHidingRule') {
            throw new Error('Expected ElementHidingRule');
        }

        const { domains } = node;
        const cloned = cloneDomainListNode(domains);

        expect(cloned).toEqual(domains);
        expect(cloned).not.toBe(domains);
        expect(cloned.children[0]).not.toBe(domains.children[0]);
    });

    it('should clone domains independently', () => {
        const node = parse('example.com##.ad');

        if (node.type !== 'ElementHidingRule') {
            throw new Error('Expected ElementHidingRule');
        }

        const cloned = cloneDomainListNode(node.domains);
        cloned.children[0].value = 'mutated.com';

        expect(node.domains.children[0].value).toBe('example.com');
    });
});

describe('cloneScriptletRuleNode', () => {
    it('should clone a ParameterList with null entries', () => {
        const node = parse("example.com#%#//scriptlet('log', 'test')");

        if (node.type !== 'ScriptletInjectionRule') {
            throw new Error('Expected ScriptletInjectionRule');
        }

        const paramList = node.body.children[0];
        const cloned = cloneScriptletRuleNode(paramList);

        expect(cloned).toEqual(paramList);
        expect(cloned).not.toBe(paramList);
        expect(cloned.children[0]).not.toBe(paramList.children[0]);
    });
});

// cloneAnyRule — comment rules

describe('cloneAnyRule — comment rules', () => {
    it('should clone a CommentRule', () => {
        const node = parse('! This is a comment');
        const cloned = cloneAnyRule(node);

        expect(cloned).toEqual(node);
        expect(cloned).not.toBe(node);

        if (cloned.type !== 'CommentRule' || node.type !== 'CommentRule') {
            throw new Error('Expected CommentRule');
        }

        expect(cloned.marker).not.toBe(node.marker);
        expect(cloned.text).not.toBe(node.text);

        // Mutation isolation
        cloned.text.value = 'mutated';
        expect(node.text.value).toBe(' This is a comment');
    });

    it('should clone a MetadataCommentRule', () => {
        const node = parse('! Title: My Filter List');
        const cloned = cloneAnyRule(node);

        expect(cloned).toEqual(node);
        expect(cloned).not.toBe(node);

        if (cloned.type !== 'MetadataCommentRule' || node.type !== 'MetadataCommentRule') {
            throw new Error('Expected MetadataCommentRule');
        }

        expect(cloned.header).not.toBe(node.header);
        expect(cloned.value).not.toBe(node.value);
    });

    it('should clone a PreProcessorCommentRule', () => {
        const node = parse('!#if (adguard)');
        const cloned = cloneAnyRule(node);

        expect(cloned).toEqual(node);
        expect(cloned).not.toBe(node);
    });

    it('should clone an AgentCommentRule', () => {
        const node = parse('[Adblock Plus 2.0]');
        const cloned = cloneAnyRule(node);

        expect(cloned).toEqual(node);
        expect(cloned).not.toBe(node);

        if (cloned.type !== 'AgentCommentRule' || node.type !== 'AgentCommentRule') {
            throw new Error('Expected AgentCommentRule');
        }

        expect(cloned.children[0]).not.toBe(node.children[0]);
        expect(cloned.children[0].adblock).not.toBe(node.children[0].adblock);
    });

    it('should clone a HintCommentRule', () => {
        const node = parse('!+ PLATFORM(windows, mac)');
        const cloned = cloneAnyRule(node);

        expect(cloned).toEqual(node);
        expect(cloned).not.toBe(node);

        if (cloned.type !== 'HintCommentRule' || node.type !== 'HintCommentRule') {
            throw new Error('Expected HintCommentRule');
        }

        expect(cloned.children[0]).not.toBe(node.children[0]);
        expect(cloned.children[0].name).not.toBe(node.children[0].name);
    });
});

// cloneAnyRule — network rules

describe('cloneAnyRule — network rules', () => {
    it('should clone a basic NetworkRule', () => {
        const node = parse('||example.com^');
        const cloned = cloneAnyRule(node);

        expect(cloned).toEqual(node);
        expect(cloned).not.toBe(node);

        if (cloned.type !== 'NetworkRule' || node.type !== 'NetworkRule') {
            throw new Error('Expected NetworkRule');
        }

        expect(cloned.pattern).not.toBe(node.pattern);

        // Mutation isolation
        cloned.pattern.value = 'mutated';
        expect(node.pattern.value).toBe('||example.com^');
    });

    it('should clone a NetworkRule with modifiers', () => {
        const node = parse('||example.com^$script,domain=example.org');
        const cloned = cloneAnyRule(node);

        expect(cloned).toEqual(node);
        expect(cloned).not.toBe(node);

        if (cloned.type !== 'NetworkRule' || node.type !== 'NetworkRule') {
            throw new Error('Expected NetworkRule');
        }

        expect(cloned.modifiers).not.toBe(node.modifiers);
        expect(cloned.modifiers!.children[0]).not.toBe(node.modifiers!.children[0]);
    });

    it('should clone a HostRule', () => {
        // HostRuleParser parses hosts-file format directly
        const node = HostRuleParser.parse('127.0.0.1 example.com example.org');
        const cloned = cloneAnyNetworkRule(node);

        expect(cloned).toEqual(node);
        expect(cloned).not.toBe(node);
        expect(cloned.type).toBe('HostRule');

        if (cloned.type !== 'HostRule' || node.type !== 'HostRule') {
            throw new Error('Expected HostRule');
        }

        expect(cloned.ip).not.toBe(node.ip);
        expect(cloned.hostnames).not.toBe(node.hostnames);
        expect(cloned.hostnames.children[0]).not.toBe(node.hostnames.children[0]);
    });
});

// cloneAnyRule — cosmetic rules

describe('cloneAnyRule — cosmetic rules', () => {
    it('should clone an ElementHidingRule', () => {
        const node = parse('example.com,~example.org##.ad-banner');
        const cloned = cloneAnyRule(node);

        expect(cloned).toEqual(node);
        expect(cloned).not.toBe(node);

        if (cloned.type !== 'ElementHidingRule' || node.type !== 'ElementHidingRule') {
            throw new Error('Expected ElementHidingRule');
        }

        expect(cloned.domains).not.toBe(node.domains);
        expect(cloned.domains.children[0]).not.toBe(node.domains.children[0]);
        expect(cloned.body).not.toBe(node.body);

        // Mutation isolation
        cloned.domains.children[0].value = 'mutated.com';
        expect(node.domains.children[0].value).toBe('example.com');
    });

    it('should clone a CssInjectionRule', () => {
        const node = parse('example.com#$#body { padding-top: 0 !important; }');
        const cloned = cloneAnyRule(node);

        expect(cloned).toEqual(node);
        expect(cloned).not.toBe(node);

        if (cloned.type !== 'CssInjectionRule' || node.type !== 'CssInjectionRule') {
            throw new Error('Expected CssInjectionRule');
        }

        expect(cloned.body).not.toBe(node.body);
        expect(cloned.body.selectorList).not.toBe(node.body.selectorList);
    });

    it('should clone a ScriptletInjectionRule', () => {
        const node = parse("example.com#%#//scriptlet('log', 'arg1')");
        const cloned = cloneAnyRule(node);

        expect(cloned).toEqual(node);
        expect(cloned).not.toBe(node);

        if (cloned.type !== 'ScriptletInjectionRule' || node.type !== 'ScriptletInjectionRule') {
            throw new Error('Expected ScriptletInjectionRule');
        }

        expect(cloned.body).not.toBe(node.body);
        expect(cloned.body.children[0]).not.toBe(node.body.children[0]);
    });

    it('should clone a JsInjectionRule', () => {
        const node = parse('example.com#%#let a = 2;');
        const cloned = cloneAnyRule(node);

        expect(cloned).toEqual(node);
        expect(cloned).not.toBe(node);

        if (cloned.type !== 'JsInjectionRule' || node.type !== 'JsInjectionRule') {
            throw new Error('Expected JsInjectionRule');
        }

        expect(cloned.body).not.toBe(node.body);
    });

    it('should clone an EmptyRule', () => {
        const node = parse('');

        expect(node.type).toBe('EmptyRule');

        const cloned = cloneAnyRule(node);

        expect(cloned).toEqual(node);
        expect(cloned).not.toBe(node);
    });
});

// cloneAnyCommentRule / cloneAnyNetworkRule / cloneAnyCosmeticRule

describe('cloneAnyCommentRule', () => {
    it('should produce a deep independent copy', () => {
        const node = parse('! Version: 2.0');

        if (node.type !== 'MetadataCommentRule') {
            throw new Error('Expected MetadataCommentRule');
        }

        const cloned = cloneAnyCommentRule(node);
        expect(cloned).toEqual(node);
        expect(cloned).not.toBe(node);
    });
});

describe('cloneAnyNetworkRule', () => {
    it('should produce a deep independent copy', () => {
        const node = parse('@@||example.com^$important');

        if (node.type !== 'NetworkRule') {
            throw new Error('Expected NetworkRule');
        }

        const cloned = cloneAnyNetworkRule(node);
        expect(cloned).toEqual(node);
        expect(cloned).not.toBe(node);
    });
});

describe('cloneAnyCosmeticRule', () => {
    it('should produce a deep independent copy', () => {
        const node = parse('example.com#@#.ad');

        if (node.type !== 'ElementHidingRule') {
            throw new Error('Expected ElementHidingRule');
        }

        const cloned = cloneAnyCosmeticRule(node);
        expect(cloned).toEqual(node);
        expect(cloned).not.toBe(node);
    });
});
