import { HtmlRuleAttributes } from './html-rule-attributes';
/**
 * Encapsulates document element matching
 */
export declare class HtmlRuleSelector {
    /**
     * Html Rule parse result
     */
    private ruleAttributes;
    /**
     * Constructor
     *
     * @param parsedHtmlRule
     */
    constructor(parsedHtmlRule: HtmlRuleAttributes);
    /**
     * Returns matched elements for provided html rule
     *
     * @param doc document object
     * @return Array of elements or null
     */
    getMatchedElements(doc: HTMLDocument): Element[] | null;
    /**
     * Checks if element is filtered by provided rule
     *
     * @param element to check
     * @return {boolean} is element filtered
     */
    private isFiltered;
    /**
     * Searches for parent element to delete.
     * Suitable parent elements are set by 'parent-elements' attribute.
     * If suitable element found - returns it. Otherwise - returns null.
     *
     * @param element Element evaluated against this rule
     * @return Parent element to be deleted
     */
    private searchForParentElement;
}
