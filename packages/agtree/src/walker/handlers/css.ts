/**
 * @file Traversal handlers for CSS-related AST nodes.
 */

import type {
    AttributeSelectorWithValue,
    ComplexSelector,
    CssAtRule,
    CssBlock,
    CssDeclaration,
    CssDeclarationList,
    CssRule,
    PseudoClassSelector,
    SelectorList,
} from '../../nodes';

import type { VisitChildFn } from './misc';

/**
 * Visit children of a CssDeclaration node.
 *
 * @param node CssDeclaration node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitCssDeclaration(node: CssDeclaration, visitChild: VisitChildFn, reverse: boolean): void {
    if (reverse) {
        if (!visitChild(node.value, node)) {
            return;
        }
        visitChild(node.property, node);
    } else {
        if (!visitChild(node.property, node)) {
            return;
        }
        visitChild(node.value, node);
    }
}

/**
 * Visit children of a CssDeclarationList node.
 *
 * @param node CssDeclarationList node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitCssDeclarationList(node: CssDeclarationList, visitChild: VisitChildFn, reverse: boolean): void {
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
 * Visit children of a CssBlock node.
 *
 * @param node CssBlock node.
 * @param visitChild Callback to visit each child.
 */
export function visitCssBlock(node: CssBlock, visitChild: VisitChildFn): void {
    visitChild(node.declarationList, node);
}

/**
 * Visit children of a CssRule node.
 *
 * @param node CssRule node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitCssRule(node: CssRule, visitChild: VisitChildFn, reverse: boolean): void {
    if (reverse) {
        if (!visitChild(node.block, node)) {
            return;
        }
        visitChild(node.prelude, node);
    } else {
        if (!visitChild(node.prelude, node)) {
            return;
        }
        visitChild(node.block, node);
    }
}

/**
 * Visit children of a CssAtRule node.
 *
 * @param node CssAtRule node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitCssAtRule(node: CssAtRule, visitChild: VisitChildFn, reverse: boolean): void {
    if (reverse) {
        if (node.block !== null) {
            if (!visitChild(node.block, node)) {
                return;
            }
        }
        if (node.prelude !== null) {
            if (!visitChild(node.prelude, node)) {
                return;
            }
        }
        visitChild(node.name, node);
    } else {
        if (!visitChild(node.name, node)) {
            return;
        }
        if (node.prelude !== null) {
            if (!visitChild(node.prelude, node)) {
                return;
            }
        }
        if (node.block !== null) {
            visitChild(node.block, node);
        }
    }
}

/**
 * Visit children of a PseudoClassSelector node.
 *
 * @param node PseudoClassSelector node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitPseudoClassSelector(node: PseudoClassSelector, visitChild: VisitChildFn, reverse: boolean): void {
    if (reverse) {
        if (node.argument !== undefined) {
            if (!visitChild(node.argument, node)) {
                return;
            }
        }
        visitChild(node.name, node);
    } else {
        if (!visitChild(node.name, node)) {
            return;
        }
        if (node.argument !== undefined) {
            visitChild(node.argument, node);
        }
    }
}

/**
 * Visit children of an AttributeSelectorWithValue node.
 *
 * @param node AttributeSelectorWithValue node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitAttributeSelectorWithValue(
    node: AttributeSelectorWithValue,
    visitChild: VisitChildFn,
    reverse: boolean,
): void {
    if (reverse) {
        if (node.flag !== undefined) {
            if (!visitChild(node.flag, node)) {
                return;
            }
        }
        if (!visitChild(node.value, node)) {
            return;
        }
        if (!visitChild(node.operator, node)) {
            return;
        }
        visitChild(node.name, node);
    } else {
        if (!visitChild(node.name, node)) {
            return;
        }
        if (!visitChild(node.operator, node)) {
            return;
        }
        if (!visitChild(node.value, node)) {
            return;
        }
        if (node.flag !== undefined) {
            visitChild(node.flag, node);
        }
    }
}

/**
 * Visit children of a ComplexSelector node.
 *
 * @param node ComplexSelector node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitComplexSelector(node: ComplexSelector, visitChild: VisitChildFn, reverse: boolean): void {
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
 * Visit children of a SelectorList node.
 *
 * @param node SelectorList node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitSelectorList(node: SelectorList, visitChild: VisitChildFn, reverse: boolean): void {
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
