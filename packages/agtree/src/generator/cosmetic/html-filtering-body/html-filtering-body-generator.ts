import { type Value, type HtmlFilteringRuleBody } from '../../../nodes';
import { BaseGenerator } from '../../base-generator';
import { ValueGenerator } from '../../misc/value-generator';
import { SelectorListGenerator } from '../selector/selector-list-generator';

/**
 * HTML Filtering body generator.
 */
export class HtmlFilteringBodyGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the HTML filtering rule body.
     *
     * @param node HTML filtering rule body.
     *
     * @returns String representation of the rule body.
     *
     * @throws Error if the rule body is invalid.
     */
    public static generate(node: Value | HtmlFilteringRuleBody): string {
        if (node.type === 'Value') {
            return ValueGenerator.generate(node);
        }

        return SelectorListGenerator.generate(node.selectorList);
    }
}
