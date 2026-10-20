/**
 * @file Custom clone functions for AST nodes.
 *
 * Faster than a generic deep-clone library because we know the exact structure
 * of each node type and only copy what's needed.
 *
 * @todo Maybe move them to parser classes as 'clone' methods.
 */

import {
    type AgentCommentRule,
    type AnyCommentRule,
    type AnyNetworkRule,
    type AnyCosmeticRule,
    type AnyRule,
    type CommentRule,
    type ConfigCommentRule,
    type ConfigNode,
    type CssInjectionRule,
    type DomainList,
    type ElementHidingRule,
    type EmptyRule,
    type HintCommentRule,
    type HtmlFilteringRule,
    type HtmlFilteringRuleBody,
    type HostRule,
    type InvalidRule,
    type JsInjectionRule,
    type MetadataCommentRule,
    type Modifier,
    type ModifierList,
    type NetworkRule,
    type ParameterList,
    type PreProcessorCommentRule,
    type ScriptletInjectionRule,
    type SelectorList,
    type Value,
    CommentRuleType,
    CosmeticRuleType,
    NetworkRuleType,
} from '../nodes';
import { isNull } from '../utils/type-guards';

// Value nodes only contain primitives, spread is enough
function cloneValue<T>(node: Value<T>): Value<T> {
    return { ...node };
}

// ConfigNode.value is an arbitrary object, structuredClone is the safe option here
function cloneConfigNode(node: ConfigNode): ConfigNode {
    return {
        ...node,
        value: structuredClone(node.value),
    };
}

// raws only has primitive fields (text, nl), but it's still an object reference
type Raws = NonNullable<import('../nodes').RuleBase['raws']>;
function cloneRaws(raws: Raws | undefined): Raws | undefined {
    return raws ? { ...raws } : undefined;
}

/**
 * Clones a scriptlet rule node.
 *
 * @param node Node to clone.
 *
 * @returns Cloned node.
 */
export function cloneScriptletRuleNode(node: ParameterList): ParameterList {
    return {
        ...node,
        children: node.children.map((child) => (isNull(child) ? null : { ...child })),
    };
}

/**
 * Clones a domain list node.
 *
 * @param node Node to clone.
 *
 * @returns Cloned node.
 */
export function cloneDomainListNode(node: DomainList): DomainList {
    return {
        ...node,
        children: node.children.map((domain) => ({ ...domain })),
    };
}

/**
 * Clones a modifier list node.
 *
 * @param node Node to clone.
 *
 * @returns Cloned node.
 */
export function cloneModifierListNode(node: ModifierList): ModifierList {
    return {
        ...node,
        children: node.children.map((modifier): Modifier => {
            const res: Modifier = {
                ...modifier,
                name: { ...modifier.name },
            };

            if (modifier.value) {
                res.value = { ...modifier.value };
            }

            return res;
        }),
    };
}

// HtmlFilteringRuleBody has a nested SelectorList, so we go one level deeper
function cloneHtmlFilteringRuleBody(node: HtmlFilteringRuleBody): HtmlFilteringRuleBody {
    const selectorList: SelectorList = {
        ...node.selectorList,
        children: node.selectorList.children.map((complexSelector) => ({
            ...complexSelector,
            children: complexSelector.children.map((child) => ({ ...child })),
        })),
    };

    return { ...node, selectorList };
}

// --- comment rules ---

function cloneCommentRule(node: CommentRule): CommentRule {
    return {
        ...node,
        raws: cloneRaws(node.raws),
        marker: cloneValue(node.marker),
        text: cloneValue(node.text),
    };
}

function cloneMetadataCommentRule(node: MetadataCommentRule): MetadataCommentRule {
    return {
        ...node,
        raws: cloneRaws(node.raws),
        marker: cloneValue(node.marker),
        header: cloneValue(node.header),
        value: cloneValue(node.value),
    };
}

function cloneConfigCommentRule(node: ConfigCommentRule): ConfigCommentRule {
    const result: ConfigCommentRule = {
        ...node,
        raws: cloneRaws(node.raws),
        marker: cloneValue(node.marker),
        command: cloneValue(node.command),
    };

    if (node.params) {
        result.params = node.params.type === 'ConfigNode'
            ? cloneConfigNode(node.params)
            : cloneScriptletRuleNode(node.params);
    }

    if (node.comment) {
        result.comment = cloneValue(node.comment);
    }

    return result;
}

function clonePreProcessorCommentRule(node: PreProcessorCommentRule): PreProcessorCommentRule {
    const result: PreProcessorCommentRule = {
        ...node,
        raws: cloneRaws(node.raws),
        name: cloneValue(node.name),
    };

    if (node.params) {
        if (node.params.type === 'Value') {
            result.params = cloneValue(node.params);
        } else if (node.params.type === 'ParameterList') {
            result.params = cloneScriptletRuleNode(node.params);
        } else {
            // expression nodes are rare and have no dedicated clone path yet
            result.params = structuredClone(node.params);
        }
    }

    return result;
}

function cloneAgentCommentRule(node: AgentCommentRule): AgentCommentRule {
    return {
        ...node,
        raws: cloneRaws(node.raws),
        children: node.children.map((agent) => ({
            ...agent,
            adblock: cloneValue(agent.adblock),
            ...(agent.version ? { version: cloneValue(agent.version) } : {}),
        })),
    };
}

function cloneHintCommentRule(node: HintCommentRule): HintCommentRule {
    return {
        ...node,
        raws: cloneRaws(node.raws),
        children: node.children.map((hint) => ({
            ...hint,
            name: cloneValue(hint.name),
            ...(hint.params ? { params: cloneScriptletRuleNode(hint.params) } : {}),
        })),
    };
}

// --- network rules ---

function cloneNetworkRule(node: NetworkRule): NetworkRule {
    const result: NetworkRule = {
        ...node,
        raws: cloneRaws(node.raws),
        pattern: cloneValue(node.pattern),
    };

    if (node.modifiers) {
        result.modifiers = cloneModifierListNode(node.modifiers);
    }

    return result;
}

function cloneHostRule(node: HostRule): HostRule {
    const result: HostRule = {
        ...node,
        raws: cloneRaws(node.raws),
        ip: cloneValue(node.ip),
        hostnames: {
            ...node.hostnames,
            children: node.hostnames.children.map((h) => ({ ...h })),
        },
    };

    if (node.comment) {
        result.comment = cloneValue(node.comment);
    }

    return result;
}

// --- cosmetic rules ---

function cloneElementHidingRule(node: ElementHidingRule): ElementHidingRule {
    return {
        ...node,
        raws: cloneRaws(node.raws),
        domains: cloneDomainListNode(node.domains),
        separator: cloneValue(node.separator),
        body: { ...node.body, selectorList: cloneValue(node.body.selectorList) },
        ...(node.modifiers ? { modifiers: cloneModifierListNode(node.modifiers) } : {}),
    };
}

function cloneCssInjectionRule(node: CssInjectionRule): CssInjectionRule {
    const body = {
        ...node.body,
        selectorList: cloneValue(node.body.selectorList),
        ...(node.body.mediaQueryList ? { mediaQueryList: cloneValue(node.body.mediaQueryList) } : {}),
        ...(node.body.declarationList ? { declarationList: cloneValue(node.body.declarationList) } : {}),
    };

    return {
        ...node,
        raws: cloneRaws(node.raws),
        domains: cloneDomainListNode(node.domains),
        separator: cloneValue(node.separator),
        body,
        ...(node.modifiers ? { modifiers: cloneModifierListNode(node.modifiers) } : {}),
    };
}

function cloneScriptletInjectionRule(node: ScriptletInjectionRule): ScriptletInjectionRule {
    return {
        ...node,
        raws: cloneRaws(node.raws),
        domains: cloneDomainListNode(node.domains),
        separator: cloneValue(node.separator),
        body: {
            ...node.body,
            children: node.body.children.map((paramList) => cloneScriptletRuleNode(paramList)),
        },
        ...(node.modifiers ? { modifiers: cloneModifierListNode(node.modifiers) } : {}),
    };
}

function cloneHtmlFilteringRule(node: HtmlFilteringRule): HtmlFilteringRule {
    const body = node.body.type === 'HtmlFilteringRuleBody'
        ? cloneHtmlFilteringRuleBody(node.body)
        : cloneValue(node.body as Value);

    return {
        ...node,
        raws: cloneRaws(node.raws),
        domains: cloneDomainListNode(node.domains),
        separator: cloneValue(node.separator),
        body,
        ...(node.modifiers ? { modifiers: cloneModifierListNode(node.modifiers) } : {}),
    };
}

function cloneJsInjectionRule(node: JsInjectionRule): JsInjectionRule {
    return {
        ...node,
        raws: cloneRaws(node.raws),
        domains: cloneDomainListNode(node.domains),
        separator: cloneValue(node.separator),
        body: cloneValue(node.body),
        ...(node.modifiers ? { modifiers: cloneModifierListNode(node.modifiers) } : {}),
    };
}

// --- public API ---

/**
 * Clones any comment rule node.
 *
 * @param node Node to clone.
 *
 * @returns Cloned node.
 */
export function cloneAnyCommentRule<T extends AnyCommentRule>(node: T): T {
    switch (node.type) {
        case CommentRuleType.CommentRule:
            return cloneCommentRule(node) as T;
        case CommentRuleType.MetadataCommentRule:
            return cloneMetadataCommentRule(node) as T;
        case CommentRuleType.ConfigCommentRule:
            return cloneConfigCommentRule(node) as T;
        case CommentRuleType.PreProcessorCommentRule:
            return clonePreProcessorCommentRule(node) as T;
        case CommentRuleType.AgentCommentRule:
            return cloneAgentCommentRule(node) as T;
        case CommentRuleType.HintCommentRule:
            return cloneHintCommentRule(node) as T;
        default:
            throw new Error(`Unknown comment rule type: ${(node as AnyCommentRule).type}`);
    }
}

/**
 * Clones any network rule node.
 *
 * @param node Node to clone.
 *
 * @returns Cloned node.
 */
export function cloneAnyNetworkRule<T extends AnyNetworkRule>(node: T): T {
    switch (node.type) {
        case NetworkRuleType.NetworkRule:
            return cloneNetworkRule(node) as T;
        case NetworkRuleType.HostRule:
            return cloneHostRule(node) as T;
        default:
            throw new Error(`Unknown network rule type: ${(node as AnyNetworkRule).type}`);
    }
}

/**
 * Clones any cosmetic rule node.
 *
 * @param node Node to clone.
 *
 * @returns Cloned node.
 */
export function cloneAnyCosmeticRule<T extends AnyCosmeticRule>(node: T): T {
    switch (node.type) {
        case CosmeticRuleType.ElementHidingRule:
            return cloneElementHidingRule(node) as T;
        case CosmeticRuleType.CssInjectionRule:
            return cloneCssInjectionRule(node) as T;
        case CosmeticRuleType.ScriptletInjectionRule:
            return cloneScriptletInjectionRule(node) as T;
        case CosmeticRuleType.HtmlFilteringRule:
            return cloneHtmlFilteringRule(node) as T;
        case CosmeticRuleType.JsInjectionRule:
            return cloneJsInjectionRule(node) as T;
        default:
            throw new Error(`Unknown cosmetic rule type: ${(node as AnyCosmeticRule).type}`);
    }
}

/**
 * Clones any AST rule node.
 *
 * Faster than `clone-deep` because we know the exact structure of each node type
 * and don't need to traverse arbitrary objects.
 *
 * @param node Node to clone.
 *
 * @returns Cloned node.
 *
 * @example
 * ```ts
 * const cloned = cloneAnyRule(RuleParser.parse('example.com##.ad'));
 * cloned.domains.children[0].value = 'other.com'; // original is not affected
 * ```
 */
export function cloneAnyRule(node: AnyRule): AnyRule {
    switch (node.category) {
        case 'Empty':
            return { ...node };
        case 'Invalid':
            return { ...node, error: { ...node.error } } as InvalidRule;
        case 'Comment':
            return cloneAnyCommentRule(node);
        case 'Network':
            return cloneAnyNetworkRule(node);
        case 'Cosmetic':
            return cloneAnyCosmeticRule(node);
        default:
            throw new Error(`Unknown rule category: ${(node as AnyRule).category}`);
    }
}
