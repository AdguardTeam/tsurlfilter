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
    const { selectorList } = node;

    // Must have exactly one complex selector
    if (selectorList.children.length !== 1) {
        return false;
    }

    const complexSelector = selectorList.children[0];

    // Must have exactly one complex selector item
    if (complexSelector.children.length !== 1) {
        return false;
    }

    const complexSelectorItem = complexSelector.children[0];

    // Must not have combinator
    if (complexSelectorItem.combinator !== undefined) {
        return false;
    }

    const { selector: compoundSelector } = complexSelectorItem;

    // Must have exactly one simple selector
    if (compoundSelector.children.length !== 1) {
        return false;
    }

    const simpleSelector = compoundSelector.children[0];

    return (
        // Should be a pseudo-class selector
        simpleSelector.type === 'CssPseudoClassSelector'
        // Pseudo-class selector name should match `UBO_RESPONSEHEADER_FN`
        && simpleSelector.name.value === UBO_RESPONSEHEADER_FN
        // Should have argument
        && simpleSelector.argument !== undefined
    );
}
