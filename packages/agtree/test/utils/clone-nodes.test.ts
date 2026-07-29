/**
 * @file Unit tests for src/utils/clone-nodes.ts.
 *
 * Each test verifies:
 * 1. Structural equality — the clone equals the original.
 * 2. Referential isolation — the clone is a distinct object; mutating it
 *    does not affect the original.
 * 3. Optional-property handling — undefined fields are absent in the clone.
 */

import { describe, expect, it } from 'vitest';

import {
    CommentRuleType,
    CosmeticRuleType,
    ListItemNodeType,
    ListNodeType,
    NetworkRuleType,
    NodeType,
    RuleCategory,
} from '../../src/nodes';
import {
    cloneAgentCommentRule,
    cloneAppList,
    cloneCommentRule,
    cloneConfigCommentRule,
    cloneCssAtRule,
    cloneCssAtRulePrelude,
    cloneCssBlock,
    cloneCssInjectionRule,
    cloneCssInjectionRuleBody,
    cloneCssRule,
    cloneDomainList,
    cloneElementHidingRule,
    cloneElementHidingRuleBody,
    cloneEmptyRule,
    cloneExpression,
    cloneFilterList,
    cloneHintCommentRule,
    cloneHostRule,
    cloneHtmlFilteringRule,
    cloneInvalidRule,
    cloneJsInjectionRule,
    cloneListItem,
    cloneMetadataCommentRule,
    cloneMethodList,
    cloneModifier,
    cloneModifierList,
    cloneNetworkRule,
    cloneParameter,
    cloneParameterList,
    clonePreProcessorCommentRule,
    cloneRaw,
    cloneRawRule,
    cloneRule,
    cloneScriptletInjectionRule,
    cloneScriptletInjectionRuleBody,
    cloneSelectorList,
    cloneStealthOptionList,
    cloneUboSelector,
    cloneValue,
} from '../../src/utils/clone-nodes';
import { QuoteType } from '../../src/utils/quotes';
import { SYNTAX_ADG, SYNTAX_UBO } from '../../src/utils/syntax-flags';
import type { SyntaxFlags } from '../../src/utils/syntax-flags';

// A valid SyntaxFlags value for tests (ADG | UBO).
const TEST_SYNTAX = (SYNTAX_ADG | SYNTAX_UBO) as SyntaxFlags;

// ─── Leaf nodes ───────────────────────────────────────────────────────────────

describe('cloneValue', () => {
    it('clones a Value node with all optional properties', () => {
        const original = {
            type: NodeType.Value, value: 'hello', start: 0, end: 5, raw: 'hello',
        };
        const result = cloneValue(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
    });

    it('omits optional properties when they are absent', () => {
        const original = { type: NodeType.Value, value: 'test' };
        const result = cloneValue(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect('start' in result).toBe(false);
        expect('end' in result).toBe(false);
        expect('raw' in result).toBe(false);
    });

    it('mutation on clone does not affect original', () => {
        const original = { type: NodeType.Value, value: 'before' };
        const result = cloneValue(original);
        result.value = 'after';

        expect(original.value).toBe('before');
    });
});

describe('cloneRaw', () => {
    it('clones a Raw node', () => {
        const original = {
            type: NodeType.Raw, value: 'raw text', start: 0, end: 8,
        };
        const result = cloneRaw(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
    });
});

describe('cloneParameter', () => {
    it('clones a Parameter node', () => {
        const original = {
            type: NodeType.Parameter,
            value: 'arg0',
            quoteType: QuoteType.Single,
        };
        const result = cloneParameter(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
    });

    it('clones a Parameter node with no-quote type', () => {
        const original = {
            type: NodeType.Parameter,
            value: 'set-constant',
            quoteType: QuoteType.None,
        };
        const result = cloneParameter(original);

        expect(result.quoteType).toBe(QuoteType.None);
        expect(result).not.toBe(original);
    });
});

describe('cloneListItem', () => {
    it('clones a Domain list item', () => {
        const original = { type: ListItemNodeType.Domain, value: 'example.com', exception: false };
        const result = cloneListItem(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
    });

    it('clones an exception domain', () => {
        const original = { type: ListItemNodeType.Domain, value: 'example.org', exception: true };
        const result = cloneListItem(original);

        expect(result.exception).toBe(true);
        expect(result).not.toBe(original);
    });
});

// ─── Sub-nodes ────────────────────────────────────────────────────────────────

describe('cloneParameterList', () => {
    it('clones a ParameterList with mixed children including null', () => {
        const original = {
            type: NodeType.ParameterList,
            children: [
                { type: NodeType.Parameter, value: 'scriptlet-name', quoteType: QuoteType.Single },
                null,
                { type: NodeType.Parameter, value: 'arg1', quoteType: QuoteType.Single },
            ],
        };
        const result = cloneParameterList(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.children).not.toBe(original.children);
        expect(result.children[0]).not.toBe(original.children[0]);
        expect(result.children[1]).toBeNull();
    });

    it('pushing to clone does not affect original', () => {
        const original = {
            type: NodeType.ParameterList,
            children: [{ type: NodeType.Parameter, value: 'name', quoteType: QuoteType.None }],
        };
        const result = cloneParameterList(original);
        result.children.push(null);

        expect(original.children).toHaveLength(1);
    });
});

describe('cloneModifier', () => {
    it('clones a Modifier without value or exception', () => {
        const original = {
            type: NodeType.Modifier,
            name: { type: NodeType.Value, value: 'third-party' },
        };
        const result = cloneModifier(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.name).not.toBe(original.name);
        expect('value' in result).toBe(false);
        expect('exception' in result).toBe(false);
    });

    it('clones a Modifier with value and exception', () => {
        const original = {
            type: NodeType.Modifier,
            name: { type: NodeType.Value, value: 'domain' },
            value: { type: NodeType.Value, value: 'example.com' },
            exception: true,
        };
        const result = cloneModifier(original);

        expect(result).toEqual(original);
        expect(result.name).not.toBe(original.name);
        expect(result.value).not.toBe(original.value);
    });

    it('mutation on cloned name does not affect original', () => {
        const original = {
            type: NodeType.Modifier,
            name: { type: NodeType.Value, value: 'script' },
        };
        const result = cloneModifier(original);
        result.name.value = 'changed';

        expect(original.name.value).toBe('script');
    });
});

describe('cloneModifierList', () => {
    it('clones a ModifierList with all children', () => {
        const original = {
            type: NodeType.ModifierList,
            children: [
                { type: NodeType.Modifier, name: { type: NodeType.Value, value: 'script' } },
                {
                    type: NodeType.Modifier,
                    name: { type: NodeType.Value, value: 'domain' },
                    value: { type: NodeType.Value, value: 'example.com' },
                },
            ],
        };
        const result = cloneModifierList(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.children).not.toBe(original.children);
        expect(result.children[0]).not.toBe(original.children[0]);
        expect(result.children[0].name).not.toBe(original.children[0].name);
    });

    it('popping from clone does not affect original', () => {
        const original = {
            type: NodeType.ModifierList,
            children: [{ type: NodeType.Modifier, name: { type: NodeType.Value, value: 'script' } }],
        };
        const result = cloneModifierList(original);
        result.children.pop();

        expect(original.children).toHaveLength(1);
    });
});

describe('cloneDomainList', () => {
    it('clones a DomainList with multiple children', () => {
        const original = {
            type: ListNodeType.DomainList,
            separator: ',' as const,
            children: [
                { type: ListItemNodeType.Domain, value: 'example.com', exception: false },
                { type: ListItemNodeType.Domain, value: 'example.org', exception: true },
            ],
        };
        const result = cloneDomainList(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.children).not.toBe(original.children);
        expect(result.children[0]).not.toBe(original.children[0]);
    });

    it('mutation on child value does not affect original', () => {
        const original = {
            type: ListNodeType.DomainList,
            separator: ',' as const,
            children: [{ type: ListItemNodeType.Domain, value: 'example.com', exception: false }],
        };
        const result = cloneDomainList(original);
        result.children[0].value = 'changed.com';

        expect(original.children[0].value).toBe('example.com');
    });
});

// ─── Cosmetic rule bodies ─────────────────────────────────────────────────────

describe('cloneElementHidingRuleBody', () => {
    it('clones body with selectorList Raw', () => {
        const original = {
            type: NodeType.ElementHidingRuleBody,
            selectorList: { type: NodeType.Raw, value: '.ads' },
        };
        const result = cloneElementHidingRuleBody(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.selectorList).not.toBe(original.selectorList);
    });
});

describe('cloneScriptletInjectionRuleBody', () => {
    it('clones body with multiple ParameterList children', () => {
        const original = {
            type: NodeType.ScriptletInjectionRuleBody,
            children: [
                {
                    type: NodeType.ParameterList,
                    children: [
                        { type: NodeType.Parameter, value: 'set-constant', quoteType: QuoteType.Single },
                        { type: NodeType.Parameter, value: 'ads', quoteType: QuoteType.Single },
                    ],
                },
            ],
        };
        const result = cloneScriptletInjectionRuleBody(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.children).not.toBe(original.children);
        expect(result.children[0]).not.toBe(original.children[0]);
        expect(result.children[0].children[0]).not.toBe(original.children[0].children[0]);
    });
});

describe('cloneCssInjectionRuleBody', () => {
    it('clones body with Raw selectorList, no optional fields', () => {
        const original = {
            type: NodeType.CssInjectionRuleBody,
            selectorList: { type: NodeType.Raw, value: '.ads' },
        };
        const result = cloneCssInjectionRuleBody(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.selectorList).not.toBe(original.selectorList);
        expect('mediaQueryList' in result).toBe(false);
        expect('declarationList' in result).toBe(false);
        expect('remove' in result).toBe(false);
    });

    it('clones body with all optional fields populated', () => {
        const original = {
            type: NodeType.CssInjectionRuleBody,
            mediaQueryList: { type: NodeType.Value, value: '(max-width: 768px)' },
            selectorList: { type: NodeType.Raw, value: 'div.ad' },
            declarationList: { type: NodeType.Raw, value: 'display: none' },
            remove: true,
        };
        const result = cloneCssInjectionRuleBody(original);

        expect(result).toEqual(original);
        expect(result.mediaQueryList).not.toBe(original.mediaQueryList);
        expect(result.selectorList).not.toBe(original.selectorList);
        expect(result.declarationList).not.toBe(original.declarationList);
        expect(result.remove).toBe(true);
    });
});

// ─── Expression nodes ─────────────────────────────────────────────────────────

describe('cloneExpression', () => {
    it('clones a Variable expression', () => {
        const original = { type: NodeType.Variable, name: 'adguard' };
        const result = cloneExpression(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
    });

    it('clones a nested Operator expression', () => {
        const original = {
            type: NodeType.Operator,
            operator: '&&' as const,
            left: { type: NodeType.Variable, name: 'adguard' },
            right: { type: NodeType.Variable, name: 'windows' },
        };
        const result = cloneExpression(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        if (result.type === NodeType.Operator) {
            expect(result.left).not.toBe(original.left);
            expect(result.right).not.toBe(original.right);
        }
    });

    it('clones a Parenthesis expression', () => {
        const original = {
            type: NodeType.Parenthesis,
            expression: { type: NodeType.Variable, name: 'test' },
        };
        const result = cloneExpression(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        if (result.type === NodeType.Parenthesis) {
            expect(result.expression).not.toBe(original.expression);
        }
    });

    it('clones a deeply nested expression tree', () => {
        const original = {
            type: NodeType.Operator,
            operator: '||' as const,
            left: {
                type: NodeType.Parenthesis,
                expression: {
                    type: NodeType.Operator,
                    operator: '&&' as const,
                    left: { type: NodeType.Variable, name: 'a' },
                    right: { type: NodeType.Variable, name: 'b' },
                },
            },
            right: { type: NodeType.Variable, name: 'c' },
        };
        const result = cloneExpression(original);

        expect(result).toEqual(original);
        if (result.type === NodeType.Operator && result.left.type === NodeType.Parenthesis) {
            const originalLeft = original.left as typeof result.left;
            expect(result.left.expression).not.toBe(originalLeft.expression);
        }
    });
});

// ─── Comment rules ────────────────────────────────────────────────────────────

describe('cloneCommentRule', () => {
    it('clones a CommentRule', () => {
        const original = {
            type: CommentRuleType.CommentRule,
            category: RuleCategory.Comment,
            syntax: TEST_SYNTAX,
            marker: { type: NodeType.Value, value: '!' },
            text: { type: NodeType.Value, value: ' This is a comment' },
        };
        const result = cloneCommentRule(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.marker).not.toBe(original.marker);
        expect(result.text).not.toBe(original.text);
    });

    it('mutation on marker.value does not affect original', () => {
        const original = {
            type: CommentRuleType.CommentRule,
            category: RuleCategory.Comment,
            syntax: TEST_SYNTAX,
            marker: { type: NodeType.Value, value: '!' },
            text: { type: NodeType.Value, value: ' text' },
        };
        const result = cloneCommentRule(original);
        result.marker.value = '#';

        expect(original.marker.value).toBe('!');
    });
});

describe('cloneMetadataCommentRule', () => {
    it('clones a MetadataCommentRule', () => {
        const original = {
            type: CommentRuleType.MetadataCommentRule,
            category: RuleCategory.Comment,
            syntax: TEST_SYNTAX,
            marker: { type: NodeType.Value, value: '!' },
            header: { type: NodeType.Value, value: 'Title' },
            value: { type: NodeType.Value, value: 'My List' },
        };
        const result = cloneMetadataCommentRule(original);

        expect(result).toEqual(original);
        expect(result.header).not.toBe(original.header);
        expect(result.value).not.toBe(original.value);
    });
});

describe('cloneConfigCommentRule', () => {
    it('clones with ParameterList params', () => {
        const original = {
            type: CommentRuleType.ConfigCommentRule,
            category: RuleCategory.Comment,
            syntax: TEST_SYNTAX,
            marker: { type: NodeType.Value, value: '!' },
            command: { type: NodeType.Value, value: 'aglint-disable' },
            params: {
                type: NodeType.ParameterList,
                children: [
                    { type: NodeType.Parameter, value: 'some-rule', quoteType: QuoteType.None },
                ],
            },
        };
        const result = cloneConfigCommentRule(original);

        expect(result).toEqual(original);
        expect(result.params).not.toBe(original.params);
    });

    it('clones without params', () => {
        const original = {
            type: CommentRuleType.ConfigCommentRule,
            category: RuleCategory.Comment,
            syntax: TEST_SYNTAX,
            marker: { type: NodeType.Value, value: '!' },
            command: { type: NodeType.Value, value: 'aglint-enable' },
        };
        const result = cloneConfigCommentRule(original);

        expect(result).toEqual(original);
        expect('params' in result).toBe(false);
    });
});

describe('clonePreProcessorCommentRule', () => {
    it('clones with expression params', () => {
        const original = {
            type: CommentRuleType.PreProcessorCommentRule,
            category: RuleCategory.Comment,
            syntax: TEST_SYNTAX,
            name: { type: NodeType.Value, value: 'if' },
            params: {
                type: NodeType.Parenthesis,
                expression: { type: NodeType.Variable, name: 'adguard' },
            },
        };
        const result = clonePreProcessorCommentRule(original);

        expect(result).toEqual(original);
        expect(result.params).not.toBe(original.params);
    });

    it('clones with no params', () => {
        const original = {
            type: CommentRuleType.PreProcessorCommentRule,
            category: RuleCategory.Comment,
            syntax: TEST_SYNTAX,
            name: { type: NodeType.Value, value: 'endif' },
        };
        const result = clonePreProcessorCommentRule(original);

        expect(result).toEqual(original);
        expect('params' in result).toBe(false);
    });
});

describe('cloneAgentCommentRule', () => {
    it('clones with agents', () => {
        const original = {
            type: CommentRuleType.AgentCommentRule,
            category: RuleCategory.Comment,
            syntax: TEST_SYNTAX,
            children: [
                {
                    type: NodeType.Agent,
                    adblock: { type: NodeType.Value, value: 'AdGuard' },
                    syntax: SYNTAX_ADG,
                },
            ],
        };
        const result = cloneAgentCommentRule(original);

        expect(result).toEqual(original);
        expect(result.children).not.toBe(original.children);
        expect(result.children[0]).not.toBe(original.children[0]);
        expect(result.children[0].adblock).not.toBe(original.children[0].adblock);
    });
});

describe('cloneHintCommentRule', () => {
    it('clones with hints', () => {
        const original = {
            type: CommentRuleType.HintCommentRule,
            category: RuleCategory.Comment,
            syntax: TEST_SYNTAX,
            children: [
                {
                    type: NodeType.Hint,
                    name: { type: NodeType.Value, value: 'PLATFORM' },
                    params: {
                        type: NodeType.ParameterList,
                        children: [
                            { type: NodeType.Parameter, value: 'windows', quoteType: QuoteType.None },
                        ],
                    },
                },
            ],
        };
        const result = cloneHintCommentRule(original);

        expect(result).toEqual(original);
        expect(result.children[0]).not.toBe(original.children[0]);
        expect(result.children[0].params).not.toBe(original.children[0].params);
    });
});

// ─── Cosmetic rules ───────────────────────────────────────────────────────────

const makeDomainList = () => ({
    type: ListNodeType.DomainList,
    separator: ',' as const,
    children: [{ type: ListItemNodeType.Domain, value: 'example.com', exception: false }],
});

describe('cloneElementHidingRule', () => {
    it('clones with all fields including modifiers', () => {
        const original = {
            type: CosmeticRuleType.ElementHidingRule,
            category: RuleCategory.Cosmetic,
            syntax: TEST_SYNTAX,
            exception: false,
            domains: makeDomainList(),
            separator: { type: NodeType.Value, value: '##' },
            body: {
                type: NodeType.ElementHidingRuleBody,
                selectorList: { type: NodeType.Raw, value: '.ads' },
            },
            modifiers: {
                type: NodeType.ModifierList,
                children: [{
                    type: NodeType.Modifier,
                    name: { type: NodeType.Value, value: 'path' },
                    value: { type: NodeType.Value, value: '/page' },
                }],
            },
        };
        const result = cloneElementHidingRule(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.domains).not.toBe(original.domains);
        expect(result.separator).not.toBe(original.separator);
        expect(result.body).not.toBe(original.body);
        expect(result.modifiers).not.toBe(original.modifiers);
    });

    it('mutation on separator.value does not affect original', () => {
        const original = {
            type: CosmeticRuleType.ElementHidingRule,
            category: RuleCategory.Cosmetic,
            syntax: TEST_SYNTAX,
            exception: false,
            domains: makeDomainList(),
            separator: { type: NodeType.Value, value: '##' },
            body: {
                type: NodeType.ElementHidingRuleBody,
                selectorList: { type: NodeType.Raw, value: '.ads' },
            },
        };
        const result = cloneElementHidingRule(original);
        result.separator.value = '#@#';

        expect(original.separator.value).toBe('##');
    });

    it('omits modifiers when undefined', () => {
        const original = {
            type: CosmeticRuleType.ElementHidingRule,
            category: RuleCategory.Cosmetic,
            syntax: TEST_SYNTAX,
            exception: false,
            domains: makeDomainList(),
            separator: { type: NodeType.Value, value: '##' },
            body: {
                type: NodeType.ElementHidingRuleBody,
                selectorList: { type: NodeType.Raw, value: '.ads' },
            },
        };
        const result = cloneElementHidingRule(original);

        expect('modifiers' in result).toBe(false);
    });
});

describe('cloneCssInjectionRule', () => {
    it('clones a CssInjectionRule with Raw body', () => {
        const original = {
            type: CosmeticRuleType.CssInjectionRule,
            category: RuleCategory.Cosmetic,
            syntax: TEST_SYNTAX,
            exception: false,
            domains: makeDomainList(),
            separator: { type: NodeType.Value, value: '#$#' },
            body: {
                type: NodeType.CssInjectionRuleBody,
                selectorList: { type: NodeType.Raw, value: 'div.ad' },
                declarationList: { type: NodeType.Raw, value: 'display: none' },
            },
        };
        const result = cloneCssInjectionRule(original);

        expect(result).toEqual(original);
        expect(result.body).not.toBe(original.body);
        expect(result.body.selectorList).not.toBe(original.body.selectorList);
    });

    it('mutation on body selectorList does not affect original', () => {
        const original = {
            type: CosmeticRuleType.CssInjectionRule,
            category: RuleCategory.Cosmetic,
            syntax: TEST_SYNTAX,
            exception: false,
            domains: makeDomainList(),
            separator: { type: NodeType.Value, value: '#$#' },
            body: {
                type: NodeType.CssInjectionRuleBody,
                selectorList: { type: NodeType.Raw, value: 'div.ad' },
            },
        };
        const result = cloneCssInjectionRule(original);
        (result.body.selectorList as { value: string }).value = 'changed';

        expect((original.body.selectorList as { value: string }).value).toBe('div.ad');
    });
});

describe('cloneScriptletInjectionRule', () => {
    it('pushing to clone body.children does not affect original', () => {
        const original = {
            type: CosmeticRuleType.ScriptletInjectionRule,
            category: RuleCategory.Cosmetic,
            syntax: TEST_SYNTAX,
            exception: false,
            domains: makeDomainList(),
            separator: { type: NodeType.Value, value: '#%#' },
            body: {
                type: NodeType.ScriptletInjectionRuleBody,
                children: [{
                    type: NodeType.ParameterList,
                    children: [
                        { type: NodeType.Parameter, value: 'set-constant', quoteType: QuoteType.Single },
                    ],
                }],
            },
        };
        const result = cloneScriptletInjectionRule(original);
        result.body.children.push({ type: NodeType.ParameterList, children: [] });

        expect(original.body.children).toHaveLength(1);
    });
});

describe('cloneHtmlFilteringRule', () => {
    it('clones with Raw body (raw mode)', () => {
        const original = {
            type: CosmeticRuleType.HtmlFilteringRule,
            category: RuleCategory.Cosmetic,
            syntax: TEST_SYNTAX,
            exception: false,
            domains: makeDomainList(),
            separator: { type: NodeType.Value, value: '$$' },
            body: { type: NodeType.Raw, value: 'script[detect]' },
        };
        const result = cloneHtmlFilteringRule(original);

        expect(result).toEqual(original);
        expect(result.body).not.toBe(original.body);
    });
});

describe('cloneJsInjectionRule', () => {
    it('clones a JsInjectionRule', () => {
        const original = {
            type: CosmeticRuleType.JsInjectionRule,
            category: RuleCategory.Cosmetic,
            syntax: TEST_SYNTAX,
            exception: false,
            domains: makeDomainList(),
            separator: { type: NodeType.Value, value: '#%#' },
            body: { type: NodeType.Raw, value: 'let a = 2;' },
        };
        const result = cloneJsInjectionRule(original);

        expect(result).toEqual(original);
        expect(result.body).not.toBe(original.body);
    });
});

// ─── Network rules ────────────────────────────────────────────────────────────

describe('cloneNetworkRule', () => {
    it('clones a NetworkRule with modifiers', () => {
        const original = {
            type: NetworkRuleType.NetworkRule,
            category: RuleCategory.Network,
            syntax: TEST_SYNTAX,
            exception: false,
            pattern: { type: NodeType.Value, value: '||example.com^' },
            modifiers: {
                type: NodeType.ModifierList,
                children: [{
                    type: NodeType.Modifier,
                    name: { type: NodeType.Value, value: 'third-party' },
                }],
            },
        };
        const result = cloneNetworkRule(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.pattern).not.toBe(original.pattern);
        expect(result.modifiers).not.toBe(original.modifiers);
    });

    it('omits modifiers when undefined', () => {
        const original = {
            type: NetworkRuleType.NetworkRule,
            category: RuleCategory.Network,
            syntax: TEST_SYNTAX,
            exception: false,
            pattern: { type: NodeType.Value, value: '||example.com^' },
        };
        const result = cloneNetworkRule(original);

        expect('modifiers' in result).toBe(false);
    });
});

describe('cloneHostRule', () => {
    it('clones a HostRule with optional comment', () => {
        const original = {
            type: NetworkRuleType.HostRule,
            category: RuleCategory.Network,
            syntax: TEST_SYNTAX,
            ip: { type: NodeType.Value, value: '127.0.0.1' },
            hostnames: {
                type: NodeType.HostnameList,
                children: [{ type: NodeType.Value, value: 'example.com' }],
            },
            comment: { type: NodeType.Value, value: '# blocked' },
        };
        const result = cloneHostRule(original);

        expect(result).toEqual(original);
        expect(result.ip).not.toBe(original.ip);
        expect(result.hostnames).not.toBe(original.hostnames);
        expect(result.hostnames.children[0]).not.toBe(original.hostnames.children[0]);
        expect(result.comment).not.toBe(original.comment);
    });
});

describe('cloneEmptyRule', () => {
    it('clones an EmptyRule', () => {
        const original = {
            type: NodeType.EmptyRule,
            category: RuleCategory.Empty,
            syntax: TEST_SYNTAX,
        };
        const result = cloneEmptyRule(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
    });
});

describe('cloneRawRule', () => {
    it('clones a RawRule (no location)', () => {
        const original = {
            type: NodeType.RawRule,
            category: RuleCategory.Raw,
            syntax: TEST_SYNTAX,
            raw: '||example.com^',
        };
        const result = cloneRawRule(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
    });

    it('clones a RawRule with location fields', () => {
        const original = {
            type: NodeType.RawRule,
            category: RuleCategory.Raw,
            syntax: TEST_SYNTAX,
            raw: 'example.org##.ad',
            start: 0,
            end: 16,
        };
        const result = cloneRawRule(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.start).toBe(0);
        expect(result.end).toBe(16);
    });

    it('clones a RawRule with kind field', () => {
        const original = {
            type: NodeType.RawRule,
            category: RuleCategory.Raw,
            syntax: TEST_SYNTAX,
            raw: '||example.com^',
            kind: RuleCategory.Network as typeof RuleCategory.Network,
        };
        const result = cloneRawRule(original);

        expect(result).toEqual(original);
        expect(result.kind).toBe(RuleCategory.Network);
    });
});

describe('cloneInvalidRule', () => {
    it('clones an InvalidRule with referential isolation on error', () => {
        const original = {
            type: NodeType.InvalidRule,
            category: RuleCategory.Invalid,
            syntax: TEST_SYNTAX,
            raw: 'bad rule',
            error: {
                type: NodeType.InvalidRuleError,
                name: 'SyntaxError',
                message: 'unexpected token',
            },
        };
        const result = cloneInvalidRule(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.error).not.toBe(original.error);
    });
});

// ─── Dispatcher ───────────────────────────────────────────────────────────────

describe('cloneRule', () => {
    it('dispatches EmptyRule', () => {
        const original = {
            type: NodeType.EmptyRule,
            category: RuleCategory.Empty,
            syntax: TEST_SYNTAX,
        };
        const result = cloneRule(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
    });

    it('dispatches NetworkRule', () => {
        const original = {
            type: NetworkRuleType.NetworkRule,
            category: RuleCategory.Network,
            syntax: TEST_SYNTAX,
            exception: false,
            pattern: { type: NodeType.Value, value: '||example.com^' },
        };
        const result = cloneRule(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
    });

    it('dispatches ElementHidingRule', () => {
        const original = {
            type: CosmeticRuleType.ElementHidingRule,
            category: RuleCategory.Cosmetic,
            syntax: TEST_SYNTAX,
            exception: false,
            domains: { type: ListNodeType.DomainList, separator: ',' as const, children: [] },
            separator: { type: NodeType.Value, value: '##' },
            body: {
                type: NodeType.ElementHidingRuleBody,
                selectorList: { type: NodeType.Raw, value: '.ads' },
            },
        };
        const result = cloneRule(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
    });

    it('dispatches CommentRule', () => {
        const original = {
            type: CommentRuleType.CommentRule,
            category: RuleCategory.Comment,
            syntax: TEST_SYNTAX,
            marker: { type: NodeType.Value, value: '!' },
            text: { type: NodeType.Value, value: ' comment' },
        };
        const result = cloneRule(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
    });

    it('dispatches InvalidRule and clones error sub-node', () => {
        const original = {
            type: NodeType.InvalidRule,
            category: RuleCategory.Invalid,
            syntax: TEST_SYNTAX,
            raw: 'bad rule',
            error: { type: NodeType.InvalidRuleError, name: 'SyntaxError', message: 'bad' },
        };
        const result = cloneRule(original);

        expect(result).toEqual(original);
        expect(result.type === NodeType.InvalidRule && result.error).not.toBe(original.error);
    });

    it('dispatches RawRule', () => {
        const original = {
            type: NodeType.RawRule,
            category: RuleCategory.Raw,
            syntax: TEST_SYNTAX,
            raw: '||example.com^',
            start: 0,
            end: 14,
        };
        const result = cloneRule(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
    });
});

// ─── SelectorList ─────────────────────────────────────────────────────────────

describe('cloneSelectorList', () => {
    it('clones a SelectorList with a simple type selector', () => {
        const original = {
            type: NodeType.SelectorList,
            children: [{
                type: NodeType.ComplexSelector,
                children: [{ type: NodeType.TypeSelector, value: 'div' }],
            }],
        };
        const result = cloneSelectorList(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.children[0]).not.toBe(original.children[0]);
        expect(result.children[0].children[0]).not.toBe(original.children[0].children[0]);
    });
});

// ─── ConfigNode branch (cloneConfigCommentRule) ───────────────────────────────

describe('cloneConfigCommentRule — ConfigNode params', () => {
    it('deep-clones ConfigNode.value with referential isolation', () => {
        const original = {
            type: CommentRuleType.ConfigCommentRule,
            category: RuleCategory.Comment,
            syntax: TEST_SYNTAX,
            marker: { type: NodeType.Value, value: '!' },
            command: { type: NodeType.Value, value: 'aglint' },
            params: {
                type: NodeType.ConfigNode,
                value: {
                    'rule-1': ['warn', { option: 'value' }],
                    'rule-2': 'off',
                } as object,
            },
        };
        const result = cloneConfigCommentRule(original);

        expect(result).toEqual(original);
        expect(result.params).not.toBe(original.params);

        // Mutating clone's nested value must not affect the original.
        if (result.params && result.params.type === NodeType.ConfigNode) {
            (result.params.value as Record<string, unknown>)['rule-1'] = ['error'];
            expect(
                (original.params.value as Record<string, unknown>)['rule-1'],
            ).toEqual(['warn', { option: 'value' }]);
        }
    });

    it('deep-clones ConfigNode.value array element isolation', () => {
        const original = {
            type: CommentRuleType.ConfigCommentRule,
            category: RuleCategory.Comment,
            syntax: TEST_SYNTAX,
            marker: { type: NodeType.Value, value: '!' },
            command: { type: NodeType.Value, value: 'aglint' },
            params: {
                type: NodeType.ConfigNode,
                value: { rules: [1, 2, 3] } as object,
            },
        };
        const result = cloneConfigCommentRule(original);

        if (result.params && result.params.type === NodeType.ConfigNode) {
            (result.params.value as Record<string, number[]>).rules.push(4);
            expect(
                (original.params.value as Record<string, number[]>).rules,
            ).toHaveLength(3);
        }
    });
});

// ─── New list node cloners ────────────────────────────────────────────────────

describe('cloneAppList', () => {
    it('clones an AppList with multiple children', () => {
        const original = {
            type: ListNodeType.AppList,
            separator: '|' as const,
            children: [
                { type: ListItemNodeType.App, value: 'Example.exe', exception: false },
                { type: ListItemNodeType.App, value: 'com.example.app', exception: true },
            ],
        };
        const result = cloneAppList(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.children).not.toBe(original.children);
        expect(result.children[0]).not.toBe(original.children[0]);
    });

    it('mutation on child value does not affect original', () => {
        const original = {
            type: ListNodeType.AppList,
            separator: '|' as const,
            children: [{ type: ListItemNodeType.App, value: 'App.exe', exception: false }],
        };
        const result = cloneAppList(original);
        result.children[0].value = 'Changed.exe';

        expect(original.children[0].value).toBe('App.exe');
    });
});

describe('cloneMethodList', () => {
    it('clones a MethodList', () => {
        const original = {
            type: ListNodeType.MethodList,
            separator: '|' as const,
            children: [
                { type: ListItemNodeType.Method, value: 'get', exception: false },
                { type: ListItemNodeType.Method, value: 'post', exception: false },
            ],
        };
        const result = cloneMethodList(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.children[0]).not.toBe(original.children[0]);
    });
});

describe('cloneStealthOptionList', () => {
    it('clones a StealthOptionList', () => {
        const original = {
            type: ListNodeType.StealthOptionList,
            separator: '|' as const,
            children: [
                { type: ListItemNodeType.StealthOption, value: 'referrer', exception: false },
                { type: ListItemNodeType.StealthOption, value: 'ip', exception: false },
            ],
        };
        const result = cloneStealthOptionList(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.children[0]).not.toBe(original.children[0]);
    });
});

describe('cloneFilterList', () => {
    it('clones a FilterList with rule children', () => {
        const original = {
            type: NodeType.FilterList,
            children: [
                {
                    type: NodeType.EmptyRule,
                    category: RuleCategory.Empty,
                    syntax: TEST_SYNTAX,
                },
                {
                    type: NetworkRuleType.NetworkRule,
                    category: RuleCategory.Network,
                    syntax: TEST_SYNTAX,
                    exception: false,
                    pattern: { type: NodeType.Value, value: '||example.com^' },
                },
            ],
        };
        const result = cloneFilterList(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.children).not.toBe(original.children);
        expect(result.children[0]).not.toBe(original.children[0]);
        expect(result.children[1]).not.toBe(original.children[1]);
    });

    it('mutation on a child rule does not affect original', () => {
        const original = {
            type: NodeType.FilterList,
            children: [{
                type: NetworkRuleType.NetworkRule,
                category: RuleCategory.Network,
                syntax: TEST_SYNTAX,
                exception: false,
                pattern: { type: NodeType.Value, value: '||example.com^' },
            }],
        };
        const result = cloneFilterList(original);
        const clonedRule = result.children[0];
        if (clonedRule.type === NetworkRuleType.NetworkRule) {
            (clonedRule as typeof original.children[0]).pattern.value = 'changed';
        }

        expect(original.children[0].pattern.value).toBe('||example.com^');
    });
});

// ─── New CSS node cloners ─────────────────────────────────────────────────────

describe('cloneCssBlock', () => {
    it('clones a CssBlock with a declaration list', () => {
        const original = {
            type: NodeType.CssBlock,
            declarationList: {
                type: NodeType.CssDeclarationList,
                children: [{
                    type: NodeType.CssDeclaration,
                    property: { type: NodeType.Value, value: 'display' },
                    value: { type: NodeType.Value, value: 'none' },
                    important: false,
                }],
            },
        };
        const result = cloneCssBlock(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.declarationList).not.toBe(original.declarationList);
        expect(result.declarationList.children[0]).not.toBe(original.declarationList.children[0]);
    });
});

describe('cloneCssAtRulePrelude', () => {
    it('clones a CssAtRulePrelude', () => {
        const original = { type: NodeType.CssAtRulePrelude, value: '(min-width: 400px)', start: 0 };
        const result = cloneCssAtRulePrelude(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
    });
});

describe('cloneCssRule', () => {
    it('clones a CssRule with Raw prelude and Raw block', () => {
        const original = {
            type: NodeType.CssRule,
            prelude: { type: NodeType.Raw, value: 'div.ad' },
            block: { type: NodeType.Raw, value: 'display: none' },
        };
        const result = cloneCssRule(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.prelude).not.toBe(original.prelude);
        expect(result.block).not.toBe(original.block);
    });

    it('mutation on block.value does not affect original', () => {
        const original = {
            type: NodeType.CssRule,
            prelude: { type: NodeType.Raw, value: 'div' },
            block: { type: NodeType.Raw, value: 'color: red' },
        };
        const result = cloneCssRule(original);
        (result.block as { value: string }).value = 'changed';

        expect((original.block as { value: string }).value).toBe('color: red');
    });
});

describe('cloneCssAtRule', () => {
    it('clones a CssAtRule with non-null prelude and block', () => {
        const original = {
            type: NodeType.CssAtRule,
            name: { type: NodeType.Value, value: 'media' },
            prelude: { type: NodeType.CssAtRulePrelude, value: '(max-width: 768px)' },
            block: { type: NodeType.Raw, value: 'div { display: none }' },
        };
        const result = cloneCssAtRule(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.name).not.toBe(original.name);
        expect(result.prelude).not.toBe(original.prelude);
        expect(result.block).not.toBe(original.block);
    });

    it('clones a CssAtRule with null prelude and null block', () => {
        const original = {
            type: NodeType.CssAtRule,
            name: { type: NodeType.Value, value: 'charset' },
            prelude: null,
            block: null,
        };
        const result = cloneCssAtRule(original);

        expect(result.prelude).toBeNull();
        expect(result.block).toBeNull();
        expect(result).toEqual(original);
    });
});

describe('cloneUboSelector', () => {
    it('clones a UboSelector without modifiers', () => {
        const original = {
            type: NodeType.UboSelector,
            selector: { type: NodeType.Value, value: '.ad:has(.banner)' },
        };
        const result = cloneUboSelector(original);

        expect(result).toEqual(original);
        expect(result).not.toBe(original);
        expect(result.selector).not.toBe(original.selector);
        expect('modifiers' in result).toBe(false);
    });

    it('clones a UboSelector with modifiers', () => {
        const original = {
            type: NodeType.UboSelector,
            selector: { type: NodeType.Value, value: '.ad' },
            modifiers: {
                type: NodeType.ModifierList,
                children: [{
                    type: NodeType.Modifier,
                    name: { type: NodeType.Value, value: 'matches-path' },
                    value: { type: NodeType.Value, value: '/page' },
                }],
            },
        };
        const result = cloneUboSelector(original);

        expect(result).toEqual(original);
        expect(result.modifiers).not.toBe(original.modifiers);
        expect(result.modifiers!.children[0]).not.toBe(original.modifiers!.children[0]);
    });
});
