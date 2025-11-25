import { type HtmlFilteringRuleBody } from '../nodes';
import { UBO_RESPONSEHEADER_FN } from '../utils/constants';

/**
 * Checks whether the given HTML filtering rule body represents a uBlock-style response header removal rule.
 *
 * @param node Potential response header removal rule node.
 *
 * @returns `true` if the node is a response header removal rule, `false` otherwise.
 */
export function isUboResponseHeaderRemovalRuleBody(node: HtmlFilteringRuleBody): boolean {
    return (
        // Must have exactly one selector
        node.selectors.length === 1
        // Selector must not have tag name
        && !node.selectors[0].tagName
        // Selector must not have attributes
        && node.selectors[0].attributes.length === 0
        // Selector must have exactly one pseudo-class
        && node.selectors[0].pseudoClasses.length === 1
        // Pseudo-class must be `responseheader`
        && node.selectors[0].pseudoClasses[0].name.value === UBO_RESPONSEHEADER_FN
    );
}
