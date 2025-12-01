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
    return (
        // Must have exactly one selector list
        node.children.length === 1
        // Must have exactly one selector
        && node.children[0].children.length === 1
        // Must have exactly one part
        && node.children[0].children[0].children.length === 1
        // Should be a pseudo class
        && node.children[0].children[0].children[0].type === 'HtmlFilteringRuleSelectorPseudoClass'
        // Pseudo class name should match `responseheader`
        && node.children[0].children[0].children[0].name.value === UBO_RESPONSEHEADER_FN
    );
}
