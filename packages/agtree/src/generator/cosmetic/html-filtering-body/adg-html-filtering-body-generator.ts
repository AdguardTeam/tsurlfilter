import { type Value, type HtmlFilteringRuleBody } from '../../../nodes';
import { QuoteUtils } from '../../../utils';
import { BaseGenerator } from '../../base-generator';
import { HtmlFilteringBodyGenerator } from './html-filtering-body-generator';

/**
 * AdGuard HTML Filtering body generator.
 */
export class AdgHtmlFilteringBodyGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the AdGuard HTML filtering rule body.
     *
     * @param node HTML filtering rule body.
     *
     * @returns String representation of the rule body.
     *
     * @throws Error if the rule body is invalid.
     */
    public static generate(node: Value | HtmlFilteringRuleBody): string {
        const raw = HtmlFilteringBodyGenerator.generate(node);
        return QuoteUtils.unescapeAttributeDoubleQuotes(raw);
    }
}
