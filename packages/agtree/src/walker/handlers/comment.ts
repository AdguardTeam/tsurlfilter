/**
 * @file Traversal handlers for comment-related AST nodes.
 */

import type {
    Agent,
    AgentCommentRule,
    CommentRule,
    ConfigCommentRule,
    Hint,
    HintCommentRule,
    MetadataCommentRule,
    PreProcessorCommentRule,
} from '../../nodes';

import type { VisitChildFn } from './misc';

/**
 * Visit children of a CommentRule node.
 *
 * @param node CommentRule node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitCommentRule(node: CommentRule, visitChild: VisitChildFn, reverse: boolean): void {
    if (reverse) {
        if (!visitChild(node.text, node)) {
            return;
        }
        visitChild(node.marker, node);
    } else {
        if (!visitChild(node.marker, node)) {
            return;
        }
        visitChild(node.text, node);
    }
}

/**
 * Visit children of a MetadataCommentRule node.
 *
 * @param node MetadataCommentRule node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitMetadataCommentRule(
    node: MetadataCommentRule,
    visitChild: VisitChildFn,
    reverse: boolean,
): void {
    if (reverse) {
        if (!visitChild(node.value, node)) {
            return;
        }
        if (!visitChild(node.header, node)) {
            return;
        }
        visitChild(node.marker, node);
    } else {
        if (!visitChild(node.marker, node)) {
            return;
        }
        if (!visitChild(node.header, node)) {
            return;
        }
        visitChild(node.value, node);
    }
}

/**
 * Visit children of a ConfigCommentRule node.
 *
 * @param node ConfigCommentRule node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitConfigCommentRule(
    node: ConfigCommentRule,
    visitChild: VisitChildFn,
    reverse: boolean,
): void {
    if (reverse) {
        if (node.comment !== undefined) {
            if (!visitChild(node.comment, node)) {
                return;
            }
        }
        if (node.params !== undefined) {
            if (!visitChild(node.params, node)) {
                return;
            }
        }
        if (!visitChild(node.command, node)) {
            return;
        }
        visitChild(node.marker, node);
    } else {
        if (!visitChild(node.marker, node)) {
            return;
        }
        if (!visitChild(node.command, node)) {
            return;
        }
        if (node.params !== undefined) {
            if (!visitChild(node.params, node)) {
                return;
            }
        }
        if (node.comment !== undefined) {
            visitChild(node.comment, node);
        }
    }
}

/**
 * Visit children of a PreProcessorCommentRule node.
 *
 * @param node PreProcessorCommentRule node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitPreProcessorCommentRule(
    node: PreProcessorCommentRule,
    visitChild: VisitChildFn,
    reverse: boolean,
): void {
    if (reverse) {
        if (node.params !== undefined) {
            if (!visitChild(node.params, node)) {
                return;
            }
        }
        visitChild(node.name, node);
    } else {
        if (!visitChild(node.name, node)) {
            return;
        }
        if (node.params !== undefined) {
            visitChild(node.params, node);
        }
    }
}

/**
 * Visit children of an Agent node.
 *
 * @param node Agent node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitAgent(node: Agent, visitChild: VisitChildFn, reverse: boolean): void {
    if (reverse) {
        if (node.version !== undefined) {
            if (!visitChild(node.version, node)) {
                return;
            }
        }
        visitChild(node.adblock, node);
    } else {
        if (!visitChild(node.adblock, node)) {
            return;
        }
        if (node.version !== undefined) {
            visitChild(node.version, node);
        }
    }
}

/**
 * Visit children of an AgentCommentRule node.
 *
 * @param node AgentCommentRule node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitAgentCommentRule(node: AgentCommentRule, visitChild: VisitChildFn, reverse: boolean): void {
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
 * Visit children of a Hint node.
 *
 * @param node Hint node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitHint(node: Hint, visitChild: VisitChildFn, reverse: boolean): void {
    if (reverse) {
        if (node.params !== undefined) {
            if (!visitChild(node.params, node)) {
                return;
            }
        }
        visitChild(node.name, node);
    } else {
        if (!visitChild(node.name, node)) {
            return;
        }
        if (node.params !== undefined) {
            visitChild(node.params, node);
        }
    }
}

/**
 * Visit children of a HintCommentRule node.
 *
 * @param node HintCommentRule node.
 * @param visitChild Callback to visit each child.
 * @param reverse Whether to iterate in reverse.
 */
export function visitHintCommentRule(node: HintCommentRule, visitChild: VisitChildFn, reverse: boolean): void {
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
