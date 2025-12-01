import { type HtmlFilteringRuleBody } from '../nodes';
import { UBO_RESPONSEHEADER_FN } from '../utils/constants';

/**
 * Checks whether the given HTML filtering rule body represents a uBlock-style response header removal rule.
 *
 * @param node Potential response header removal rule node.
 *
 * @returns `true` if the node is a response header removal rule, `false` otherwise.
 *
 * @note This method checks `HtmlFilteringRuleBody` because, response header
 * removal rule syntax is same as uBlock-style HTML filtering rule syntax.
 */
export function isUboResponseHeaderRemovalRuleBody(node: HtmlFilteringRuleBody): boolean {
    // Must have exactly one selector list
    if (node.children.length !== 1) {
        return false;
    }

    const selectorList = node.children[0];

    // Must have exactly one selector
    if (selectorList.children.length !== 1) {
        return false;
    }

    const selector = selectorList.children[0];

    // Must have exactly one part and should not have combinator
    if (selector.children.length !== 1 || selector.combinator !== undefined) {
        return false;
    }

    const part = selector.children[0];

    return (
        // Should be a pseudo class
        part.type === 'HtmlFilteringRuleSelectorPseudoClass'
        // Pseudo class name should match `responseheader`
        && part.name.value === UBO_RESPONSEHEADER_FN
        // Should be a functional pseudo class
        && part.isFunction
        // Should have argument
        && part.argument !== undefined
    );
}
