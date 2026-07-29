/* eslint-disable no-param-reassign */
/**
 * @file Type-specific AST node clone functions for all node types defined in
 * `nodes` — leaf nodes, list nodes, CSS nodes, rule bodies, expression
 * nodes, comment rules, cosmetic rules, and network rules.
 *
 * All functions enumerate properties explicitly for maximum performance.
 * Spread operator, Object.assign, and structuredClone are intentionally avoided.
 */

import {
    type Agent,
    type AgentCommentRule,
    type AnyExpressionNode,
    type AnyRule,
    type App,
    type AppList,
    type CommentRule,
    CommentRuleType,
    type ComplexSelector,
    type ConfigCommentRule,
    CosmeticRuleType,
    type CssAtRule,
    type CssAtRulePrelude,
    type CssBlock,
    type CssDeclaration,
    type CssDeclarationList,
    type CssInjectionRule,
    type CssInjectionRuleBody,
    type CssRule,
    type Domain,
    type DomainList,
    type ElementHidingRule,
    type ElementHidingRuleBody,
    type EmptyRule,
    type ExpressionOperatorNode,
    type ExpressionParenthesisNode,
    type ExpressionVariableNode,
    type FilterList,
    type Hint,
    type HintCommentRule,
    type HostnameList,
    type HostRule,
    type HtmlFilteringRule,
    type HtmlFilteringRuleBody,
    type InvalidRule,
    type InvalidRuleError,
    type JsInjectionRule,
    type ListItem,
    type ListItemNodeType,
    type MetadataCommentRule,
    type Method,
    type MethodList,
    type Modifier,
    type ModifierList,
    type NetworkRule,
    NetworkRuleType,
    type Node,
    NodeType,
    type Parameter,
    type ParameterList,
    type PreProcessorCommentRule,
    type Raw,
    type RawRule,
    type RuleBase,
    RuleCategory,
    type ScriptletInjectionRule,
    type ScriptletInjectionRuleBody,
    type SelectorCombinator,
    type SelectorList,
    type SimpleSelector,
    type StealthOption,
    type StealthOptionList,
    type UboSelector,
    type Value,
} from '../nodes';

/**
 * Type guard that narrows a `Value | Raw` union to `Raw`.
 *
 * Prefer this over `as Raw` casts after a discriminator check — it is
 * reusable and keeps the surrounding code free of type assertions.
 *
 * @param node Node to test.
 *
 * @returns `true` if `node` is a {@link Raw} node.
 */
function isRaw(node: Value | Raw): node is Raw {
    return node.type === NodeType.Raw;
}

/**
 * A JSON-compatible value: primitive, array, or plain-object literal.
 * Used to constrain the type of `ConfigNode.value`.
 */
type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

/**
 * Deep-clones a JSON-compatible value by recursively copying each element.
 *
 * Only handles JSON-primitive scalars (`string`, `number`, `boolean`, `null`),
 * plain-object literals, and arrays thereof. This is intentionally strict so
 * that non-serialisable values (functions, Dates, symbols, etc.) cause an
 * incorrect clone rather than silently being dropped as they would with
 * `JSON.parse(JSON.stringify(...))`.
 *
 * @param value JSON-compatible value to clone.
 *
 * @returns Deep-cloned value.
 */
function clonePlainObject(value: JsonValue): JsonValue {
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(value)) {
        const result: JsonValue[] = new Array(value.length);
        for (let i = 0; i < value.length; i += 1) {
            result[i] = clonePlainObject(value[i]);
        }
        return result;
    }
    const result: { [key: string]: JsonValue } = {};
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        result[key] = clonePlainObject((value as { [key: string]: JsonValue })[key]);
    }
    return result;
}

/**
 * Copies the common optional `Node` base fields (`start`, `end`, `raw`)
 * onto a target node when they are defined on the source.
 *
 * @param source Source node to read from.
 * @param target Target node to write onto.
 */
function copyNodeBase(source: Node, target: Node): void {
    if (source.start !== undefined) {
        target.start = source.start;
    }
    if (source.end !== undefined) {
        target.end = source.end;
    }
    if (source.raw !== undefined) {
        target.raw = source.raw;
    }
}

/**
 * Copies `RuleBase` fields (`syntax`, `category`) onto a target rule.
 * Also delegates to {@link copyNodeBase} for the shared `Node` fields.
 *
 * @param source Source rule to read from.
 * @param target Target rule to write onto.
 */
function copyRuleBase(source: RuleBase, target: RuleBase): void {
    target.syntax = source.syntax;
    target.category = source.category;
    copyNodeBase(source, target);
}

/**
 * Clones a `Value` node.
 *
 * @param node Value node to clone.
 *
 * @returns Cloned Value node.
 */
export function cloneValue<T = string>(node: Value<T>): Value<T> {
    const result: Value<T> = {
        type: node.type,
        value: node.value,
    };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `Raw` node.
 *
 * @param node Raw node to clone.
 *
 * @returns Cloned Raw node.
 */
export function cloneRaw(node: Raw): Raw {
    const result: Raw = {
        type: node.type,
        value: node.value,
    };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `Parameter` node.
 *
 * @param node Parameter node to clone.
 *
 * @returns Cloned Parameter node.
 */
export function cloneParameter(node: Parameter): Parameter {
    const result: Parameter = {
        type: node.type,
        value: node.value,
        quoteType: node.quoteType,
    };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `ListItem` node (`Domain`, `App`, `Method`, or `StealthOption`).
 *
 * @param node ListItem node to clone.
 *
 * @returns Cloned ListItem node.
 */
export function cloneListItem<T extends ListItemNodeType>(node: ListItem<T>): ListItem<T> {
    const result: ListItem<T> = {
        type: node.type,
        value: node.value,
        exception: node.exception,
    };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `ParameterList` node, preserving `null` entries in children.
 *
 * @param node ParameterList node to clone.
 *
 * @returns Cloned ParameterList node.
 */
export function cloneParameterList(node: ParameterList): ParameterList {
    const children: (Parameter | null)[] = new Array(node.children.length);
    for (let i = 0; i < node.children.length; i += 1) {
        const child = node.children[i];
        children[i] = child === null ? null : cloneParameter(child);
    }
    const result: ParameterList = {
        type: node.type,
        children,
    };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `Modifier` node.
 *
 * @param node Modifier node to clone.
 *
 * @returns Cloned Modifier node.
 */
export function cloneModifier(node: Modifier): Modifier {
    const result: Modifier = {
        type: node.type,
        name: cloneValue(node.name),
    };
    if (node.exception !== undefined) {
        result.exception = node.exception;
    }
    if (node.value !== undefined) {
        result.value = isRaw(node.value)
            ? cloneRaw(node.value)
            : cloneValue(node.value);
    }
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `ModifierList` node.
 *
 * @param node ModifierList node to clone.
 *
 * @returns Cloned ModifierList node.
 */
export function cloneModifierList(node: ModifierList): ModifierList {
    const children: Modifier[] = new Array(node.children.length);
    for (let i = 0; i < node.children.length; i += 1) {
        children[i] = cloneModifier(node.children[i]);
    }
    const result: ModifierList = {
        type: node.type,
        children,
    };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `DomainList` node.
 *
 * @param node DomainList node to clone.
 *
 * @returns Cloned DomainList node.
 */
export function cloneDomainList(node: DomainList): DomainList {
    const children: Domain[] = new Array(node.children.length);
    for (let i = 0; i < node.children.length; i += 1) {
        children[i] = cloneListItem(node.children[i]);
    }
    const result: DomainList = {
        type: node.type,
        separator: node.separator,
        children,
    };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones an `AppList` node.
 *
 * @param node AppList node to clone.
 *
 * @returns Cloned AppList node.
 */
export function cloneAppList(node: AppList): AppList {
    const children: App[] = new Array(node.children.length);
    for (let i = 0; i < node.children.length; i += 1) {
        children[i] = cloneListItem(node.children[i]);
    }
    const result: AppList = {
        type: node.type,
        separator: node.separator,
        children,
    };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `MethodList` node.
 *
 * @param node MethodList node to clone.
 *
 * @returns Cloned MethodList node.
 */
export function cloneMethodList(node: MethodList): MethodList {
    const children: Method[] = new Array(node.children.length);
    for (let i = 0; i < node.children.length; i += 1) {
        children[i] = cloneListItem(node.children[i]);
    }
    const result: MethodList = {
        type: node.type,
        separator: node.separator,
        children,
    };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `StealthOptionList` node.
 *
 * @param node StealthOptionList node to clone.
 *
 * @returns Cloned StealthOptionList node.
 */
export function cloneStealthOptionList(node: StealthOptionList): StealthOptionList {
    const children: StealthOption[] = new Array(node.children.length);
    for (let i = 0; i < node.children.length; i += 1) {
        children[i] = cloneListItem(node.children[i]);
    }
    const result: StealthOptionList = {
        type: node.type,
        separator: node.separator,
        children,
    };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `SimpleSelector` node (TypeSelector, ClassSelector, IdSelector,
 * AttributeSelector, or PseudoClassSelector).
 *
 * @param node SimpleSelector to clone.
 *
 * @returns Cloned SimpleSelector.
 */
function cloneSimpleSelector(node: SimpleSelector): SimpleSelector {
    switch (node.type) {
        case NodeType.TypeSelector:
        case NodeType.ClassSelector:
        case NodeType.IdSelector: {
            const result: typeof node = { type: node.type, value: node.value };
            copyNodeBase(node, result);
            return result;
        }
        case NodeType.AttributeSelector: {
            if ('operator' in node) {
                const withVal: typeof node = {
                    type: node.type,
                    name: cloneValue(node.name),
                    operator: cloneValue(node.operator),
                    value: cloneValue(node.value),
                };
                if (node.flag !== undefined) {
                    withVal.flag = cloneValue(node.flag);
                }
                copyNodeBase(node, withVal);
                return withVal;
            }
            const withoutVal: typeof node = { type: node.type, name: cloneValue(node.name) };
            copyNodeBase(node, withoutVal);
            return withoutVal;
        }
        case NodeType.PseudoClassSelector: {
            const result: typeof node = { type: node.type, name: cloneValue(node.name) };
            if (node.argument !== undefined) {
                result.argument = cloneValue(node.argument);
            }
            copyNodeBase(node, result);
            return result;
        }
        default:
            throw new Error(`Unknown simple selector type: ${(node as SimpleSelector).type}`);
    }
}

/**
 * Clones a `SelectorCombinator` node.
 *
 * @param node SelectorCombinator to clone.
 *
 * @returns Cloned SelectorCombinator.
 */
function cloneSelectorCombinator(node: SelectorCombinator): SelectorCombinator {
    const result: SelectorCombinator = { type: node.type, value: node.value };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `ComplexSelector` node.
 *
 * @param node ComplexSelector to clone.
 *
 * @returns Cloned ComplexSelector.
 */
function cloneComplexSelector(node: ComplexSelector): ComplexSelector {
    const children: (SimpleSelector | SelectorCombinator)[] = new Array(node.children.length);
    for (let i = 0; i < node.children.length; i += 1) {
        const child = node.children[i];
        children[i] = child.type === NodeType.SelectorCombinator
            ? cloneSelectorCombinator(child as SelectorCombinator)
            : cloneSimpleSelector(child as SimpleSelector);
    }
    const result: ComplexSelector = { type: node.type, children };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `SelectorList` node.
 *
 * @param node SelectorList to clone.
 *
 * @returns Cloned SelectorList.
 */
export function cloneSelectorList(node: SelectorList): SelectorList {
    const children: ComplexSelector[] = new Array(node.children.length);
    for (let i = 0; i < node.children.length; i += 1) {
        children[i] = cloneComplexSelector(node.children[i]);
    }
    const result: SelectorList = { type: node.type, children };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `CssDeclaration` node.
 *
 * @param node CssDeclaration to clone.
 *
 * @returns Cloned CssDeclaration.
 */
function cloneCssDeclaration(node: CssDeclaration): CssDeclaration {
    const result: CssDeclaration = {
        type: node.type,
        property: cloneValue(node.property),
        value: cloneValue(node.value),
        important: node.important,
    };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `CssDeclarationList` node.
 *
 * @param node CssDeclarationList to clone.
 *
 * @returns Cloned CssDeclarationList.
 */
function cloneCssDeclarationList(node: CssDeclarationList): CssDeclarationList {
    const children: CssDeclaration[] = new Array(node.children.length);
    for (let i = 0; i < node.children.length; i += 1) {
        children[i] = cloneCssDeclaration(node.children[i]);
    }
    const result: CssDeclarationList = { type: node.type, children };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `CssBlock` node.
 *
 * @param node CssBlock to clone.
 *
 * @returns Cloned CssBlock.
 */
export function cloneCssBlock(node: CssBlock): CssBlock {
    const result: CssBlock = {
        type: node.type,
        declarationList: cloneCssDeclarationList(node.declarationList),
    };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `CssAtRulePrelude` node.
 *
 * @param node CssAtRulePrelude to clone.
 *
 * @returns Cloned CssAtRulePrelude.
 */
export function cloneCssAtRulePrelude(node: CssAtRulePrelude): CssAtRulePrelude {
    const result: CssAtRulePrelude = {
        type: node.type,
        value: node.value,
    };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `CssRule` node (a CSS qualified rule with selector prelude and block).
 *
 * Both `prelude` (`SelectorList | Raw`) and `block` (`CssBlock | Raw`) are
 * dispatched to the appropriate clone function based on their type.
 *
 * @param node CssRule to clone.
 *
 * @returns Cloned CssRule.
 */
export function cloneCssRule(node: CssRule): CssRule {
    const prelude: CssRule['prelude'] = node.prelude.type === NodeType.Raw
        ? cloneRaw(node.prelude as Raw)
        : cloneSelectorList(node.prelude as SelectorList);
    const block: CssRule['block'] = node.block.type === NodeType.CssBlock
        ? cloneCssBlock(node.block as CssBlock)
        : cloneRaw(node.block as Raw);
    const result: CssRule = { type: node.type, prelude, block };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `CssAtRule` node (e.g., `@media`, `@supports`, `@charset`).
 *
 * Handles `null` as well as `CssAtRulePrelude | Raw` for `prelude`, and
 * `null` as well as `CssBlock | Raw` for `block`.
 *
 * @param node CssAtRule to clone.
 *
 * @returns Cloned CssAtRule.
 */
export function cloneCssAtRule(node: CssAtRule): CssAtRule {
    let prelude: CssAtRule['prelude'];
    if (node.prelude === null) {
        prelude = null;
    } else if (node.prelude.type === NodeType.CssAtRulePrelude) {
        prelude = cloneCssAtRulePrelude(node.prelude as CssAtRulePrelude);
    } else {
        prelude = cloneRaw(node.prelude as Raw);
    }

    let block: CssAtRule['block'];
    if (node.block === null) {
        block = null;
    } else if (node.block.type === NodeType.CssBlock) {
        block = cloneCssBlock(node.block as CssBlock);
    } else {
        block = cloneRaw(node.block as Raw);
    }

    const result: CssAtRule = {
        type: node.type,
        name: cloneValue(node.name),
        prelude,
        block,
    };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `UboSelector` node.
 *
 * @param node UboSelector to clone.
 *
 * @returns Cloned UboSelector.
 */
export function cloneUboSelector(node: UboSelector): UboSelector {
    const result: UboSelector = {
        type: node.type,
        selector: cloneValue(node.selector),
    };
    if (node.modifiers !== undefined) {
        result.modifiers = cloneModifierList(node.modifiers);
    }
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones an `ElementHidingRuleBody` node.
 *
 * @param node ElementHidingRuleBody to clone.
 *
 * @returns Cloned ElementHidingRuleBody.
 */
export function cloneElementHidingRuleBody(node: ElementHidingRuleBody): ElementHidingRuleBody {
    const result: ElementHidingRuleBody = {
        type: node.type,
        selectorList: cloneRaw(node.selectorList),
    };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `ScriptletInjectionRuleBody` node.
 *
 * @param node ScriptletInjectionRuleBody to clone.
 *
 * @returns Cloned ScriptletInjectionRuleBody.
 */
export function cloneScriptletInjectionRuleBody(
    node: ScriptletInjectionRuleBody,
): ScriptletInjectionRuleBody {
    const children: ParameterList[] = new Array(node.children.length);
    for (let i = 0; i < node.children.length; i += 1) {
        children[i] = cloneParameterList(node.children[i]);
    }
    const result: ScriptletInjectionRuleBody = { type: node.type, children };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `CssInjectionRuleBody` node.
 *
 * Handles both `Raw` and `SelectorList` variants for `selectorList` and
 * `declarationList`.
 *
 * @param node CssInjectionRuleBody to clone.
 *
 * @returns Cloned CssInjectionRuleBody.
 */
export function cloneCssInjectionRuleBody(node: CssInjectionRuleBody): CssInjectionRuleBody {
    const result: CssInjectionRuleBody = {
        type: node.type,
        selectorList: node.selectorList.type === NodeType.Raw
            ? cloneRaw(node.selectorList)
            : cloneSelectorList(node.selectorList),
    };
    if (node.mediaQueryList !== undefined) {
        result.mediaQueryList = cloneValue(node.mediaQueryList);
    }
    if (node.declarationList !== undefined) {
        result.declarationList = node.declarationList.type === NodeType.Raw
            ? cloneRaw(node.declarationList)
            : cloneCssDeclarationList(node.declarationList);
    }
    if (node.remove !== undefined) {
        result.remove = node.remove;
    }
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones an `HtmlFilteringRuleBody` node.
 *
 * @param node HtmlFilteringRuleBody to clone.
 *
 * @returns Cloned HtmlFilteringRuleBody.
 */
export function cloneHtmlFilteringRuleBody(node: HtmlFilteringRuleBody): HtmlFilteringRuleBody {
    const result: HtmlFilteringRuleBody = {
        type: node.type,
        selectorList: cloneSelectorList(node.selectorList),
    };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones an expression node recursively.
 *
 * Handles `Variable`, `Operator` (with recursive `left`/`right`), and
 * `Parenthesis` (with recursive `expression`).
 *
 * @param node Expression node to clone.
 *
 * @returns Cloned expression node.
 */
export function cloneExpression(node: AnyExpressionNode): AnyExpressionNode {
    switch (node.type) {
        case NodeType.Variable: {
            const result: ExpressionVariableNode = { type: node.type, name: node.name };
            copyNodeBase(node, result);
            return result;
        }
        case NodeType.Operator: {
            const result: ExpressionOperatorNode = {
                type: node.type,
                operator: node.operator,
                left: cloneExpression(node.left),
            };
            if (node.right !== undefined) {
                result.right = cloneExpression(node.right);
            }
            copyNodeBase(node, result);
            return result;
        }
        case NodeType.Parenthesis: {
            const result: ExpressionParenthesisNode = {
                type: node.type,
                expression: cloneExpression(node.expression),
            };
            copyNodeBase(node, result);
            return result;
        }
        default:
            throw new Error(`Unknown expression node type: ${(node as AnyExpressionNode).type}`);
    }
}

/**
 * Clones an `Agent` node.
 *
 * @param node Agent to clone.
 *
 * @returns Cloned Agent.
 */
function cloneAgent(node: Agent): Agent {
    const result: Agent = {
        type: node.type,
        adblock: cloneValue(node.adblock),
        syntax: node.syntax,
    };
    if (node.version !== undefined) {
        result.version = cloneValue(node.version);
    }
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `Hint` node.
 *
 * @param node Hint to clone.
 *
 * @returns Cloned Hint.
 */
function cloneHint(node: Hint): Hint {
    const result: Hint = {
        type: node.type,
        name: cloneValue(node.name),
    };
    if (node.params !== undefined) {
        result.params = cloneParameterList(node.params);
    }
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `CommentRule` node.
 *
 * @param node CommentRule to clone.
 *
 * @returns Cloned CommentRule.
 */
export function cloneCommentRule(node: CommentRule): CommentRule {
    const result: CommentRule = {
        type: node.type,
        category: node.category,
        syntax: node.syntax,
        marker: cloneValue(node.marker),
        text: cloneValue(node.text),
    };
    copyRuleBase(node, result);
    return result;
}

/**
 * Clones a `MetadataCommentRule` node.
 *
 * @param node MetadataCommentRule to clone.
 *
 * @returns Cloned MetadataCommentRule.
 */
export function cloneMetadataCommentRule(node: MetadataCommentRule): MetadataCommentRule {
    const result: MetadataCommentRule = {
        type: node.type,
        category: node.category,
        syntax: node.syntax,
        marker: cloneValue(node.marker),
        header: cloneValue(node.header),
        value: cloneValue(node.value),
    };
    copyRuleBase(node, result);
    return result;
}

/**
 * Clones a `ConfigCommentRule` node.
 *
 * The `params.value` of a `ConfigNode` is a plain JSON-compatible object;
 * it is deep-cloned via {@link clonePlainObject}, which explicitly handles
 * JSON primitives, arrays, and plain objects without serialisation overhead.
 *
 * @param node ConfigCommentRule to clone.
 *
 * @returns Cloned ConfigCommentRule.
 */
export function cloneConfigCommentRule(node: ConfigCommentRule): ConfigCommentRule {
    const result: ConfigCommentRule = {
        type: node.type,
        category: node.category,
        syntax: node.syntax,
        marker: cloneValue(node.marker),
        command: cloneValue(node.command),
    };
    if (node.params !== undefined) {
        if (node.params.type === NodeType.ConfigNode) {
            result.params = {
                type: node.params.type,
                value: clonePlainObject(node.params.value as unknown as JsonValue) as object,
            };
        } else {
            // ParameterList
            result.params = cloneParameterList(node.params as ParameterList);
        }
    }
    if (node.comment !== undefined) {
        result.comment = cloneValue(node.comment);
    }
    copyRuleBase(node, result);
    return result;
}

/**
 * Clones a `PreProcessorCommentRule` node.
 *
 * The `params` field can be a `Value`, `ParameterList`, or any expression
 * node tree — each is handled accordingly.
 *
 * @param node PreProcessorCommentRule to clone.
 *
 * @returns Cloned PreProcessorCommentRule.
 */
export function clonePreProcessorCommentRule(
    node: PreProcessorCommentRule,
): PreProcessorCommentRule {
    const result: PreProcessorCommentRule = {
        type: node.type,
        category: node.category,
        syntax: node.syntax,
        name: cloneValue(node.name),
    };
    if (node.params !== undefined) {
        if (node.params.type === NodeType.Value) {
            result.params = cloneValue(node.params as Value);
        } else if (node.params.type === NodeType.ParameterList) {
            result.params = cloneParameterList(node.params as ParameterList);
        } else {
            result.params = cloneExpression(node.params as AnyExpressionNode);
        }
    }
    copyRuleBase(node, result);
    return result;
}

/**
 * Clones an `AgentCommentRule` node.
 *
 * @param node AgentCommentRule to clone.
 *
 * @returns Cloned AgentCommentRule.
 */
export function cloneAgentCommentRule(node: AgentCommentRule): AgentCommentRule {
    const children: Agent[] = new Array(node.children.length);
    for (let i = 0; i < node.children.length; i += 1) {
        children[i] = cloneAgent(node.children[i]);
    }
    const result: AgentCommentRule = {
        type: node.type,
        category: node.category,
        syntax: node.syntax,
        children,
    };
    copyRuleBase(node, result);
    return result;
}

/**
 * Clones a `HintCommentRule` node.
 *
 * @param node HintCommentRule to clone.
 *
 * @returns Cloned HintCommentRule.
 */
export function cloneHintCommentRule(node: HintCommentRule): HintCommentRule {
    const children: Hint[] = new Array(node.children.length);
    for (let i = 0; i < node.children.length; i += 1) {
        children[i] = cloneHint(node.children[i]);
    }
    const result: HintCommentRule = {
        type: node.type,
        category: node.category,
        syntax: node.syntax,
        children,
    };
    copyRuleBase(node, result);
    return result;
}

/**
 * Clones an `ElementHidingRule` node.
 *
 * @param node ElementHidingRule to clone.
 *
 * @returns Cloned ElementHidingRule.
 */
export function cloneElementHidingRule(node: ElementHidingRule): ElementHidingRule {
    const result: ElementHidingRule = {
        type: node.type,
        category: node.category,
        syntax: node.syntax,
        exception: node.exception,
        domains: cloneDomainList(node.domains),
        separator: cloneValue(node.separator),
        body: cloneElementHidingRuleBody(node.body),
    };
    if (node.modifiers !== undefined) {
        result.modifiers = cloneModifierList(node.modifiers);
    }
    copyRuleBase(node, result);
    return result;
}

/**
 * Clones a `CssInjectionRule` node.
 *
 * @param node CssInjectionRule to clone.
 *
 * @returns Cloned CssInjectionRule.
 */
export function cloneCssInjectionRule(node: CssInjectionRule): CssInjectionRule {
    const result: CssInjectionRule = {
        type: node.type,
        category: node.category,
        syntax: node.syntax,
        exception: node.exception,
        domains: cloneDomainList(node.domains),
        separator: cloneValue(node.separator),
        body: cloneCssInjectionRuleBody(node.body),
    };
    if (node.modifiers !== undefined) {
        result.modifiers = cloneModifierList(node.modifiers);
    }
    copyRuleBase(node, result);
    return result;
}

/**
 * Clones a `ScriptletInjectionRule` node.
 *
 * @param node ScriptletInjectionRule to clone.
 *
 * @returns Cloned ScriptletInjectionRule.
 */
export function cloneScriptletInjectionRule(
    node: ScriptletInjectionRule,
): ScriptletInjectionRule {
    const result: ScriptletInjectionRule = {
        type: node.type,
        category: node.category,
        syntax: node.syntax,
        exception: node.exception,
        domains: cloneDomainList(node.domains),
        separator: cloneValue(node.separator),
        body: cloneScriptletInjectionRuleBody(node.body),
    };
    if (node.modifiers !== undefined) {
        result.modifiers = cloneModifierList(node.modifiers);
    }
    copyRuleBase(node, result);
    return result;
}

/**
 * Clones an `HtmlFilteringRule` node.
 *
 * The body can be either a `Raw` (raw unparsed body) or a
 * `HtmlFilteringRuleBody` (fully parsed CSS selector list).
 *
 * @param node HtmlFilteringRule to clone.
 *
 * @returns Cloned HtmlFilteringRule.
 */
export function cloneHtmlFilteringRule(node: HtmlFilteringRule): HtmlFilteringRule {
    const body: HtmlFilteringRule['body'] = node.body.type === NodeType.Raw
        ? cloneRaw(node.body as Raw)
        : cloneHtmlFilteringRuleBody(node.body as HtmlFilteringRuleBody);

    const result: HtmlFilteringRule = {
        type: node.type,
        category: node.category,
        syntax: node.syntax,
        exception: node.exception,
        domains: cloneDomainList(node.domains),
        separator: cloneValue(node.separator),
        body,
    };
    if (node.modifiers !== undefined) {
        result.modifiers = cloneModifierList(node.modifiers);
    }
    copyRuleBase(node, result);
    return result;
}

/**
 * Clones a `JsInjectionRule` node.
 *
 * @param node JsInjectionRule to clone.
 *
 * @returns Cloned JsInjectionRule.
 */
export function cloneJsInjectionRule(node: JsInjectionRule): JsInjectionRule {
    const result: JsInjectionRule = {
        type: node.type,
        category: node.category,
        syntax: node.syntax,
        exception: node.exception,
        domains: cloneDomainList(node.domains),
        separator: cloneValue(node.separator),
        body: cloneRaw(node.body),
    };
    if (node.modifiers !== undefined) {
        result.modifiers = cloneModifierList(node.modifiers);
    }
    copyRuleBase(node, result);
    return result;
}

/**
 * Clones a `HostnameList` node.
 *
 * @param node HostnameList to clone.
 *
 * @returns Cloned HostnameList.
 */
function cloneHostnameList(node: HostnameList): HostnameList {
    const children: Value[] = new Array(node.children.length);
    for (let i = 0; i < node.children.length; i += 1) {
        children[i] = cloneValue(node.children[i]);
    }
    const result: HostnameList = { type: node.type, children };
    copyNodeBase(node, result);
    return result;
}

/**
 * Clones a `RawRule` node.
 *
 * @param node RawRule to clone.
 *
 * @returns Cloned RawRule.
 */
export function cloneRawRule(node: RawRule): RawRule {
    const result: RawRule = {
        type: node.type,
        category: node.category,
        syntax: node.syntax,
        raw: node.raw,
    };
    if (node.kind !== undefined) {
        result.kind = node.kind;
    }
    copyRuleBase(node, result);
    return result;
}

/**
 * Clones an `EmptyRule` node.
 *
 * @param node EmptyRule to clone.
 *
 * @returns Cloned EmptyRule.
 */
export function cloneEmptyRule(node: EmptyRule): EmptyRule {
    const result: EmptyRule = {
        type: node.type,
        category: node.category,
        syntax: node.syntax,
    };
    copyRuleBase(node, result);
    return result;
}

/**
 * Clones an `InvalidRule` node.
 *
 * @param node InvalidRule to clone.
 *
 * @returns Cloned InvalidRule.
 */
export function cloneInvalidRule(node: InvalidRule): InvalidRule {
    const error: InvalidRuleError = {
        type: node.error.type,
        name: node.error.name,
        message: node.error.message,
    };
    copyNodeBase(node.error, error);
    const result: InvalidRule = {
        type: node.type,
        category: node.category,
        syntax: node.syntax,
        raw: node.raw,
        error,
    };
    copyRuleBase(node, result);
    return result;
}

/**
 * Clones a `NetworkRule` node.
 *
 * @param node NetworkRule to clone.
 *
 * @returns Cloned NetworkRule.
 */
export function cloneNetworkRule(node: NetworkRule): NetworkRule {
    const result: NetworkRule = {
        type: node.type,
        category: node.category,
        syntax: node.syntax,
        exception: node.exception,
        pattern: cloneValue(node.pattern),
    };
    if (node.modifiers !== undefined) {
        result.modifiers = cloneModifierList(node.modifiers);
    }
    copyRuleBase(node, result);
    return result;
}

/**
 * Clones a `HostRule` node.
 *
 * @param node HostRule to clone.
 *
 * @returns Cloned HostRule.
 */
export function cloneHostRule(node: HostRule): HostRule {
    const result: HostRule = {
        type: node.type,
        category: node.category,
        syntax: node.syntax,
        ip: cloneValue(node.ip),
        hostnames: cloneHostnameList(node.hostnames),
    };
    if (node.comment !== undefined) {
        result.comment = cloneValue(node.comment);
    }
    copyRuleBase(node, result);
    return result;
}

/**
 * Clones any rule node by dispatching to the correct type-specific clone
 * function based on `category` and `type` discriminators.
 *
 * @param rule Any rule node to clone.
 *
 * @returns Cloned rule node.
 *
 * @throws If the rule category or type is unrecognised.
 */
export function cloneRule(rule: AnyRule): AnyRule {
    switch (rule.category) {
        case RuleCategory.Empty:
            return cloneEmptyRule(rule as EmptyRule);
        case RuleCategory.Raw:
            return cloneRawRule(rule as RawRule);
        case RuleCategory.Invalid:
            return cloneInvalidRule(rule as InvalidRule);
        case RuleCategory.Comment:
            switch (rule.type) {
                case CommentRuleType.CommentRule:
                    return cloneCommentRule(rule as CommentRule);
                case CommentRuleType.MetadataCommentRule:
                    return cloneMetadataCommentRule(rule as MetadataCommentRule);
                case CommentRuleType.ConfigCommentRule:
                    return cloneConfigCommentRule(rule as ConfigCommentRule);
                case CommentRuleType.PreProcessorCommentRule:
                    return clonePreProcessorCommentRule(rule as PreProcessorCommentRule);
                case CommentRuleType.AgentCommentRule:
                    return cloneAgentCommentRule(rule as AgentCommentRule);
                case CommentRuleType.HintCommentRule:
                    return cloneHintCommentRule(rule as HintCommentRule);
                default:
                    throw new Error(`Unknown comment rule type: ${(rule as AnyRule).type}`);
            }
        case RuleCategory.Cosmetic:
            switch (rule.type) {
                case CosmeticRuleType.ElementHidingRule:
                    return cloneElementHidingRule(rule as ElementHidingRule);
                case CosmeticRuleType.CssInjectionRule:
                    return cloneCssInjectionRule(rule as CssInjectionRule);
                case CosmeticRuleType.ScriptletInjectionRule:
                    return cloneScriptletInjectionRule(rule as ScriptletInjectionRule);
                case CosmeticRuleType.HtmlFilteringRule:
                    return cloneHtmlFilteringRule(rule as HtmlFilteringRule);
                case CosmeticRuleType.JsInjectionRule:
                    return cloneJsInjectionRule(rule as JsInjectionRule);
                default:
                    throw new Error(`Unknown cosmetic rule type: ${(rule as AnyRule).type}`);
            }
        case RuleCategory.Network:
            switch (rule.type) {
                case NetworkRuleType.NetworkRule:
                    return cloneNetworkRule(rule as NetworkRule);
                case NetworkRuleType.HostRule:
                    return cloneHostRule(rule as HostRule);
                default:
                    throw new Error(`Unknown network rule type: ${(rule as AnyRule).type}`);
            }
        default:
            throw new Error(`Unknown rule category: ${(rule as AnyRule).category}`);
    }
}

/**
 * Clones a `FilterList` node (top-level filter list / document node).
 *
 * Each child rule is cloned by the {@link cloneRule} dispatcher.
 *
 * @param node FilterList node to clone.
 *
 * @returns Cloned FilterList node.
 */
export function cloneFilterList(node: FilterList): FilterList {
    const children: AnyRule[] = new Array(node.children.length);
    for (let i = 0; i < node.children.length; i += 1) {
        children[i] = cloneRule(node.children[i]);
    }
    const result: FilterList = { type: node.type, children };
    copyNodeBase(node, result);
    return result;
}
