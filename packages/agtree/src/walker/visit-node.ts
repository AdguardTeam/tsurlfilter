/**
 * @file Central node dispatch — routes each node to its type-specific handler.
 *
 * Uses an exhaustive `switch` on `node.type` to guarantee compile-time errors
 * when new node types are added without updating the walker.
 */

import {
    CommentRuleType,
    CosmeticRuleType,
    ListItemNodeType,
    ListNodeType,
    NetworkRuleType,
    NodeType,
} from '../nodes';
import type {
    Agent,
    AgentCommentRule,
    AppList,
    AttributeSelectorWithoutValue,
    AttributeSelectorWithValue,
    CommentRule,
    ComplexSelector,
    ConfigCommentRule,
    CssAtRule,
    CssBlock,
    CssDeclaration,
    CssDeclarationList,
    CssInjectionRule,
    CssInjectionRuleBody,
    CssRule,
    DomainList,
    ElementHidingRule,
    ElementHidingRuleBody,
    ExpressionOperatorNode,
    ExpressionParenthesisNode,
    FilterList,
    Hint,
    HintCommentRule,
    HostnameList,
    HostRule,
    HtmlFilteringRule,
    HtmlFilteringRuleBody,
    JsInjectionRule,
    MetadataCommentRule,
    MethodList,
    Modifier,
    ModifierList,
    NetworkRule,
    ParameterList,
    PreProcessorCommentRule,
    PseudoClassSelector,
    ScriptletInjectionRule,
    ScriptletInjectionRuleBody,
    SelectorList,
    StealthOptionList,
    UboSelector,
} from '../nodes';

import {
    visitAgent,
    visitAgentCommentRule,
    visitCommentRule,
    visitConfigCommentRule,
    visitHint,
    visitHintCommentRule,
    visitMetadataCommentRule,
    visitPreProcessorCommentRule,
} from './handlers/comment';
import {
    visitAppList,
    visitCssInjectionRule,
    visitCssInjectionRuleBody,
    visitDomainList,
    visitElementHidingRule,
    visitElementHidingRuleBody,
    visitHtmlFilteringRule,
    visitHtmlFilteringRuleBody,
    visitJsInjectionRule,
    visitMethodList,
    visitScriptletInjectionRule,
    visitScriptletInjectionRuleBody,
    visitStealthOptionList,
    visitUboSelector,
} from './handlers/cosmetic';
import {
    visitAttributeSelectorWithValue,
    visitComplexSelector,
    visitCssAtRule,
    visitCssBlock,
    visitCssDeclaration,
    visitCssDeclarationList,
    visitCssRule,
    visitPseudoClassSelector,
    visitSelectorList,
} from './handlers/css';
import type { VisitChildFn } from './handlers/misc';
import {
    visitExpressionOperator,
    visitExpressionParenthesis,
    visitFilterList,
    visitParameterList,
} from './handlers/misc';
import {
    visitHostnameList,
    visitHostRule,
    visitModifier,
    visitModifierList,
    visitNetworkRule,
} from './handlers/network';
import type { AnyWalkNode } from './types';

/**
 * Dispatches to the correct handler based on `node.type`.
 *
 * The exhaustive switch ensures a compile error when a new node type is
 * added to `nodes` without a corresponding handler here.
 *
 * @param node The current node being visited.
 * @param visitChild Callback to recurse into a child node. Returns `false` if traversal should stop.
 * @param reverse Whether to visit children in reverse order.
 */
// eslint-disable-next-line max-statements
export function visitNodeChildren(node: AnyWalkNode, visitChild: VisitChildFn, reverse: boolean): void {
    const { type } = node;

    // eslint-disable-next-line default-case
    switch (type) {
        // === Leaf nodes (no children to visit) ===
        case NodeType.Value:
        case NodeType.Raw:
        case NodeType.Parameter:
        case NodeType.Variable:
        case NodeType.InvalidRuleError:
        case NodeType.RawRule:
        case NodeType.EmptyRule:
        case NodeType.ConfigNode:
        case NodeType.CssAtRulePrelude:
        case NodeType.TypeSelector:
        case NodeType.ClassSelector:
        case NodeType.IdSelector:
        case NodeType.SelectorCombinator:
            // No children — nothing to visit
            break;

        // === List item nodes (leaf-like, no child nodes) ===
        case ListItemNodeType.App:
        case ListItemNodeType.Domain:
        case ListItemNodeType.Method:
        case ListItemNodeType.StealthOption:
            break;

        // === Misc/shared nodes ===
        case NodeType.FilterList:
            visitFilterList(node as FilterList, visitChild, reverse);
            break;
        case NodeType.ParameterList:
            visitParameterList(node as ParameterList, visitChild, reverse);
            break;
        case NodeType.Operator:
            visitExpressionOperator(node as ExpressionOperatorNode, visitChild, reverse);
            break;
        case NodeType.Parenthesis:
            visitExpressionParenthesis(node as ExpressionParenthesisNode, visitChild);
            break;

        // === Comment nodes ===
        case CommentRuleType.CommentRule:
            visitCommentRule(node as CommentRule, visitChild, reverse);
            break;
        case CommentRuleType.MetadataCommentRule:
            visitMetadataCommentRule(node as MetadataCommentRule, visitChild, reverse);
            break;
        case CommentRuleType.ConfigCommentRule:
            visitConfigCommentRule(node as ConfigCommentRule, visitChild, reverse);
            break;
        case CommentRuleType.PreProcessorCommentRule:
            visitPreProcessorCommentRule(node as PreProcessorCommentRule, visitChild, reverse);
            break;
        case CommentRuleType.AgentCommentRule:
            visitAgentCommentRule(node as AgentCommentRule, visitChild, reverse);
            break;
        case CommentRuleType.HintCommentRule:
            visitHintCommentRule(node as HintCommentRule, visitChild, reverse);
            break;
        case NodeType.Agent:
            visitAgent(node as Agent, visitChild, reverse);
            break;
        case NodeType.Hint:
            visitHint(node as Hint, visitChild, reverse);
            break;

        // === Network nodes ===
        case NetworkRuleType.NetworkRule:
            visitNetworkRule(node as NetworkRule, visitChild, reverse);
            break;
        case NetworkRuleType.HostRule:
            visitHostRule(node as HostRule, visitChild, reverse);
            break;
        case NodeType.HostnameList:
            visitHostnameList(node as HostnameList, visitChild, reverse);
            break;
        case NodeType.ModifierList:
            visitModifierList(node as ModifierList, visitChild, reverse);
            break;
        case NodeType.Modifier:
            visitModifier(node as Modifier, visitChild, reverse);
            break;

        // === CSS nodes ===
        case NodeType.CssDeclaration:
            visitCssDeclaration(node as CssDeclaration, visitChild, reverse);
            break;
        case NodeType.CssDeclarationList:
            visitCssDeclarationList(node as CssDeclarationList, visitChild, reverse);
            break;
        case NodeType.CssBlock:
            visitCssBlock(node as CssBlock, visitChild);
            break;
        case NodeType.CssRule:
            visitCssRule(node as CssRule, visitChild, reverse);
            break;
        case NodeType.CssAtRule:
            visitCssAtRule(node as CssAtRule, visitChild, reverse);
            break;
        case NodeType.PseudoClassSelector:
            visitPseudoClassSelector(node as PseudoClassSelector, visitChild, reverse);
            break;
        case NodeType.AttributeSelector:
            // Discriminate between with/without value based on presence of `operator`
            if ('operator' in node) {
                visitAttributeSelectorWithValue(node as AttributeSelectorWithValue, visitChild, reverse);
            } else {
                // AttributeSelectorWithoutValue — only has `name` (a Value leaf)
                visitChild((node as AttributeSelectorWithoutValue).name as AnyWalkNode, node);
            }
            break;
        case NodeType.ComplexSelector:
            visitComplexSelector(node as ComplexSelector, visitChild, reverse);
            break;
        case NodeType.SelectorList:
            visitSelectorList(node as SelectorList, visitChild, reverse);
            break;

        // === Cosmetic rule nodes ===
        case CosmeticRuleType.ElementHidingRule:
            visitElementHidingRule(node as ElementHidingRule, visitChild, reverse);
            break;
        case CosmeticRuleType.CssInjectionRule:
            visitCssInjectionRule(node as CssInjectionRule, visitChild, reverse);
            break;
        case CosmeticRuleType.ScriptletInjectionRule:
            visitScriptletInjectionRule(node as ScriptletInjectionRule, visitChild, reverse);
            break;
        case CosmeticRuleType.HtmlFilteringRule:
            visitHtmlFilteringRule(node as HtmlFilteringRule, visitChild, reverse);
            break;
        case CosmeticRuleType.JsInjectionRule:
            visitJsInjectionRule(node as JsInjectionRule, visitChild, reverse);
            break;
        case NodeType.CssInjectionRuleBody:
            visitCssInjectionRuleBody(node as CssInjectionRuleBody, visitChild, reverse);
            break;
        case NodeType.ElementHidingRuleBody:
            visitElementHidingRuleBody(node as ElementHidingRuleBody, visitChild);
            break;
        case NodeType.ScriptletInjectionRuleBody:
            visitScriptletInjectionRuleBody(node as ScriptletInjectionRuleBody, visitChild, reverse);
            break;
        case NodeType.HtmlFilteringRuleBody:
            visitHtmlFilteringRuleBody(node as HtmlFilteringRuleBody, visitChild);
            break;

        // === List nodes ===
        case ListNodeType.DomainList:
            visitDomainList(node as DomainList, visitChild, reverse);
            break;
        case ListNodeType.AppList:
            visitAppList(node as AppList, visitChild, reverse);
            break;
        case ListNodeType.MethodList:
            visitMethodList(node as MethodList, visitChild, reverse);
            break;
        case ListNodeType.StealthOptionList:
            visitStealthOptionList(node as StealthOptionList, visitChild, reverse);
            break;

        // === UboSelector ===
        case NodeType.UboSelector:
            visitUboSelector(node as UboSelector, visitChild, reverse);
            break;

        // === InvalidRule ===
        case NodeType.InvalidRule:
            // InvalidRule has `error: InvalidRuleError` — visit it
            visitChild((node as { error: AnyWalkNode }).error, node);
            break;

        // TypeScript exhaustiveness check — will compile-error if a type is missing
        default: {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const exhaustiveCheck: never = type;
        }
    }
}
