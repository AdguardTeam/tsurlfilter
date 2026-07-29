/**
 * @file Traversal handlers for cosmetic rule AST nodes.
 */

import type {
    AppList,
    CssInjectionRule,
    CssInjectionRuleBody,
    DomainList,
    ElementHidingRule,
    ElementHidingRuleBody,
    HtmlFilteringRule,
    HtmlFilteringRuleBody,
    JsInjectionRule,
    MethodList,
    ScriptletInjectionRule,
    ScriptletInjectionRuleBody,
    StealthOptionList,
    UboSelector,
} from '../../nodes';
import type { AnyWalkNode } from '../types';

import type { VisitChildFn } from './misc';

/**
 * Visit children of a DomainList node.
 *
 * @param node DomainList node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitDomainList(node: DomainList, visitChild: VisitChildFn, reverse: boolean): void {
    const { children } = node;
    if (reverse) {
        for (let i = children.length - 1; i >= 0; i -= 1) {
            if (!visitChild(children[i], node)) {
                return;
            }
        }
    } else {
        for (let i = 0; i < children.length; i += 1) {
            if (!visitChild(children[i], node)) {
                return;
            }
        }
    }
}

/**
 * Visit children of an AppList node.
 *
 * @param node AppList node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitAppList(node: AppList, visitChild: VisitChildFn, reverse: boolean): void {
    const { children } = node;
    if (reverse) {
        for (let i = children.length - 1; i >= 0; i -= 1) {
            if (!visitChild(children[i], node)) {
                return;
            }
        }
    } else {
        for (let i = 0; i < children.length; i += 1) {
            if (!visitChild(children[i], node)) {
                return;
            }
        }
    }
}

/**
 * Visit children of a MethodList node.
 *
 * @param node MethodList node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitMethodList(node: MethodList, visitChild: VisitChildFn, reverse: boolean): void {
    const { children } = node;
    if (reverse) {
        for (let i = children.length - 1; i >= 0; i -= 1) {
            if (!visitChild(children[i], node)) {
                return;
            }
        }
    } else {
        for (let i = 0; i < children.length; i += 1) {
            if (!visitChild(children[i], node)) {
                return;
            }
        }
    }
}

/**
 * Visit children of a StealthOptionList node.
 *
 * @param node StealthOptionList node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitStealthOptionList(node: StealthOptionList, visitChild: VisitChildFn, reverse: boolean): void {
    const { children } = node;
    if (reverse) {
        for (let i = children.length - 1; i >= 0; i -= 1) {
            if (!visitChild(children[i], node)) {
                return;
            }
        }
    } else {
        for (let i = 0; i < children.length; i += 1) {
            if (!visitChild(children[i], node)) {
                return;
            }
        }
    }
}

/**
 * Visit children of a CssInjectionRuleBody node.
 *
 * @param node CssInjectionRuleBody node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitCssInjectionRuleBody(
    node: CssInjectionRuleBody,
    visitChild: VisitChildFn,
    reverse: boolean,
): void {
    if (reverse) {
        if (node.declarationList !== undefined) {
            if (!visitChild(node.declarationList, node)) {
                return;
            }
        }
        if (!visitChild(node.selectorList, node)) {
            return;
        }
        if (node.mediaQueryList !== undefined) {
            visitChild(node.mediaQueryList, node);
        }
    } else {
        if (node.mediaQueryList !== undefined) {
            if (!visitChild(node.mediaQueryList, node)) {
                return;
            }
        }
        if (!visitChild(node.selectorList, node)) {
            return;
        }
        if (node.declarationList !== undefined) {
            visitChild(node.declarationList, node);
        }
    }
}

/**
 * Visit children of an ElementHidingRuleBody node.
 *
 * @param node ElementHidingRuleBody node.
 * @param visitChild Callback to visit each child.
 */
export function visitElementHidingRuleBody(node: ElementHidingRuleBody, visitChild: VisitChildFn): void {
    visitChild(node.selectorList, node);
}

/**
 * Visit children of a ScriptletInjectionRuleBody node.
 *
 * @param node ScriptletInjectionRuleBody node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitScriptletInjectionRuleBody(
    node: ScriptletInjectionRuleBody,
    visitChild: VisitChildFn,
    reverse: boolean,
): void {
    const { children } = node;
    if (reverse) {
        for (let i = children.length - 1; i >= 0; i -= 1) {
            if (!visitChild(children[i], node)) {
                return;
            }
        }
    } else {
        for (let i = 0; i < children.length; i += 1) {
            if (!visitChild(children[i], node)) {
                return;
            }
        }
    }
}

/**
 * Visit children of an HtmlFilteringRuleBody node.
 *
 * @param node HtmlFilteringRuleBody node.
 * @param visitChild Callback to visit each child.
 */
export function visitHtmlFilteringRuleBody(node: HtmlFilteringRuleBody, visitChild: VisitChildFn): void {
    visitChild(node.selectorList, node);
}

/**
 * Helper: visit the common cosmetic rule fields (modifiers, domains, separator, body).
 *
 * @param modifiers Optional modifier list.
 * @param domains Domain list.
 * @param separator Separator value node.
 * @param body Body node.
 * @param parent Parent node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
function visitCosmeticRuleFields(
    modifiers: AnyWalkNode | undefined,
    domains: AnyWalkNode,
    separator: AnyWalkNode,
    body: AnyWalkNode,
    parent: AnyWalkNode,
    visitChild: VisitChildFn,
    reverse: boolean,
): void {
    if (reverse) {
        if (!visitChild(body, parent)) {
            return;
        }
        if (!visitChild(separator, parent)) {
            return;
        }
        if (!visitChild(domains, parent)) {
            return;
        }
        if (modifiers !== undefined) {
            visitChild(modifiers, parent);
        }
    } else {
        if (modifiers !== undefined) {
            if (!visitChild(modifiers, parent)) {
                return;
            }
        }
        if (!visitChild(domains, parent)) {
            return;
        }
        if (!visitChild(separator, parent)) {
            return;
        }
        visitChild(body, parent);
    }
}

/**
 * Visit children of an ElementHidingRule node.
 *
 * @param node ElementHidingRule node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitElementHidingRule(node: ElementHidingRule, visitChild: VisitChildFn, reverse: boolean): void {
    visitCosmeticRuleFields(
        node.modifiers as AnyWalkNode | undefined,
        node.domains,
        node.separator,
        node.body,
        node,
        visitChild,
        reverse,
    );
}

/**
 * Visit children of a CssInjectionRule node.
 *
 * @param node CssInjectionRule node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitCssInjectionRule(node: CssInjectionRule, visitChild: VisitChildFn, reverse: boolean): void {
    visitCosmeticRuleFields(
        node.modifiers as AnyWalkNode | undefined,
        node.domains,
        node.separator,
        node.body,
        node,
        visitChild,
        reverse,
    );
}

/**
 * Visit children of a ScriptletInjectionRule node.
 *
 * @param node ScriptletInjectionRule node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitScriptletInjectionRule(
    node: ScriptletInjectionRule,
    visitChild: VisitChildFn,
    reverse: boolean,
): void {
    visitCosmeticRuleFields(
        node.modifiers as AnyWalkNode | undefined,
        node.domains,
        node.separator,
        node.body,
        node,
        visitChild,
        reverse,
    );
}

/**
 * Visit children of an HtmlFilteringRule node.
 *
 * @param node HtmlFilteringRule node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitHtmlFilteringRule(node: HtmlFilteringRule, visitChild: VisitChildFn, reverse: boolean): void {
    visitCosmeticRuleFields(
        node.modifiers as AnyWalkNode | undefined,
        node.domains,
        node.separator,
        node.body,
        node,
        visitChild,
        reverse,
    );
}

/**
 * Visit children of a JsInjectionRule node.
 *
 * @param node JsInjectionRule node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitJsInjectionRule(node: JsInjectionRule, visitChild: VisitChildFn, reverse: boolean): void {
    visitCosmeticRuleFields(
        node.modifiers as AnyWalkNode | undefined,
        node.domains,
        node.separator,
        node.body,
        node,
        visitChild,
        reverse,
    );
}

/**
 * Visit children of a UboSelector node.
 *
 * @param node UboSelector node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitUboSelector(node: UboSelector, visitChild: VisitChildFn, reverse: boolean): void {
    if (reverse) {
        if (node.modifiers !== undefined) {
            if (!visitChild(node.modifiers, node)) {
                return;
            }
        }
        visitChild(node.selector, node);
    } else {
        if (!visitChild(node.selector, node)) {
            return;
        }
        if (node.modifiers !== undefined) {
            visitChild(node.modifiers, node);
        }
    }
}
