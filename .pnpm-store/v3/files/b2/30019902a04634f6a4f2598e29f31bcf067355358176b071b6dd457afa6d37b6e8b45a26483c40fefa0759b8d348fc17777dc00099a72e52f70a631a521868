import { Wildcard } from './wildcard';

/**
 * Html rule attributes
 *
 * rule = [domains] "$$" tagName [attributes]
 * domains = [domain0, domain1[, ...[, domainN]]]
 * attributes = "[" name0 = value0 "]" "[" name1 = value2 "]" ... "[" nameN = valueN "]"
 *
 * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#html-filtering-rules-syntax-1
 */
export class HtmlRuleAttributes {
    /**
     * Tag name attribute
     */
    tagName: string | undefined;

    /**
     * Composed selector
     * Parsed [attributes] excepting special attributes
     * are joined here to be a valid css selector string.
     * Example:
     * For "example.org$$div[id="ad_text"][tag-content="teas""ernet"]" rule,
     * css selector will be "div[id*="ad_text"]"
     */
    selector: string | undefined;

    /**
     * Parent search level attribute
     */
    parentSearchLevel: number | undefined;

    /**
     * Max length attribute
     * Specifies the maximum length for content of HTML element.
     * If this parameter is set and the content length exceeds the value - a rule does not apply to the element.
     */
    maxLength: number | undefined;

    /**
     * This is the most frequently used special attribute.
     * It limits selection with those elements whose innerHTML code contains the specified substring.
     */
    tagContentFilter: string | undefined;

    /**
     * This special attribute works almost like tag-content and allows you to check the innerHTML code of the document.
     * Rule will check if HTML code of the element fits to the search pattern.
     */
    wildcard: Wildcard | undefined;

    /**
     * Specifies the minimum length for content of HTML element.
     * If this parameter is set and the content length is less than preset value - a rule does not apply to the element.
     */
    minLength: number | undefined;

    /**
     * Parent elements attributes
     */
    parentElements: string[] | undefined;
}
