import { isUboResponseHeaderRemovalRuleBody } from '../../../common/ubo-html-filtering-body-common';
import { type Value, type PseudoClassSelector, type HtmlFilteringRuleBody } from '../../../nodes';
import {
    CLOSE_PARENTHESIS,
    EMPTY,
    OPEN_PARENTHESIS,
    UBO_RESPONSEHEADER_FN,
} from '../../../utils/constants';
import { BaseGenerator } from '../../base-generator';
import { ValueGenerator } from '../../misc/value-generator';
import { HtmlFilteringBodyGenerator } from './html-filtering-body-generator';

/**
 * uBlock HTML Filtering body generator.
 */
export class UboHtmlFilteringBodyGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the uBlock HTML filtering rule body
     * and also uBlock-style response header removal rules.
     *
     * @param node HTML filtering rule body.
     *
     * @returns String representation of the rule body.
     *
     * @throws Error if the rule body is invalid.
     */
    public static generate(node: Value | HtmlFilteringRuleBody): string {
        // First, check if it's a response header removal rule and return if so
        const responseHeaderBody = UboHtmlFilteringBodyGenerator.generateResponseHeaderRule(node);
        if (responseHeaderBody !== null) {
            return responseHeaderBody;
        }

        return HtmlFilteringBodyGenerator.generate(node);
    }

    /**
     * Generates a string representation of the uBlock-style response header removal rule.
     *
     * @param node Potential response header removal rule node.
     *
     * @returns String representation of the response header removal rule,
     * or `null` if the node is not a response header removal rule.
     *
     * @note This method accepts `HtmlFilteringRuleBody` as `node` because,
     * response header removal rule syntax is same as uBlock-style HTML filtering rule syntax.
     */
    private static generateResponseHeaderRule(node: Value | HtmlFilteringRuleBody): string | null {
        if (node.type !== 'HtmlFilteringRuleBody' || !isUboResponseHeaderRemovalRuleBody(node)) {
            return null;
        }

        // Length of AST nodes, types of nodes, non-null argument
        // check are already done in `isUboResponseHeaderRemovalRuleBody()`
        const { selectorList } = node;
        const complexSelector = selectorList.children[0];
        const pseudoClass = complexSelector.children[0] as PseudoClassSelector;
        const headerName = ValueGenerator.generate(pseudoClass.argument!);

        const result: string[] = [];

        result.push(UBO_RESPONSEHEADER_FN);
        result.push(OPEN_PARENTHESIS);
        result.push(headerName);
        result.push(CLOSE_PARENTHESIS);

        return result.join(EMPTY);
    }
}
