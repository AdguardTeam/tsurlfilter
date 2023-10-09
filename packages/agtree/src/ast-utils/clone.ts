/**
 * @file Custom clone functions for AST nodes, this is probably the most efficient way to clone AST nodes.
 * @todo Maybe move them to parser classes as 'clone' methods
 */

import {
    type ParameterList,
    type DomainList,
    type Modifier,
    type ModifierList,
} from '../parser/common';

/**
 * Clones a scriptlet rule node.
 *
 * @param node Node to clone
 * @returns Cloned node
 */
export function cloneScriptletRuleNode(node: ParameterList): ParameterList {
    return {
        type: node.type,
        children: node.children.map((child) => ({ ...child })),
    };
}

/**
 * Clones a domain list node.
 *
 * @param node Node to clone
 * @returns Cloned node
 */
export function cloneDomainListNode(node: DomainList): DomainList {
    return {
        type: node.type,
        separator: node.separator,
        children: node.children.map((domain) => ({ ...domain })),
    };
}

/**
 * Clones a modifier list node.
 *
 * @param node Node to clone
 * @returns Cloned node
 */
export function cloneModifierListNode(node: ModifierList): ModifierList {
    return {
        type: node.type,
        children: node.children.map((modifier): Modifier => {
            const res: Modifier = {
                type: modifier.type,
                exception: modifier.exception,
                modifier: { ...modifier.modifier },
            };

            if (modifier.value) {
                res.value = { ...modifier.value };
            }

            return res;
        }),
    };
}
