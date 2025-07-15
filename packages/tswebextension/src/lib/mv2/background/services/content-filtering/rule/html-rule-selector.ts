import { type HtmlRuleAttributes } from './html-rule-attributes';

/**
 * Encapsulates document element matching.
 */
export class HtmlRuleSelector {
    /**
     * Html Rule parse result.
     */
    private ruleAttributes: HtmlRuleAttributes;

    /**
     * Constructor.
     *
     * @param parsedHtmlRule Html rule attributes.
     */
    constructor(parsedHtmlRule: HtmlRuleAttributes) {
        this.ruleAttributes = parsedHtmlRule;
    }

    /**
     * Returns elements matched by provided html rule.
     *
     * @param doc Document object.
     *
     * @returns Array of elements or null.
     */
    public getMatchedElements(doc: Document): Element[] | null {
        // Return null if selector is not set (undefined or empty)
        if (!this.ruleAttributes.selector) {
            return null;
        }

        // At this point we have a valid selector, so its safe to use querySelectorAll
        const elements = doc.querySelectorAll(this.ruleAttributes.selector);

        let result = null;

        for (let i = 0; i < elements.length; i += 1) {
            const element = elements[i];

            let elementToDelete = null;

            if (this.isFiltered(element)) {
                if (this.ruleAttributes.parentElements) {
                    const parentElement = this.searchForParentElement(element);
                    if (parentElement) {
                        elementToDelete = parentElement;
                    }
                } else {
                    elementToDelete = element;
                }

                if (elementToDelete) {
                    if (result === null) {
                        result = [];
                    }
                    result.push(elementToDelete);
                }
            }
        }

        return result;
    }

    /**
     * Checks if element is filtered by provided rule.
     *
     * @param element Element to check.
     *
     * @returns True if element is filtered.
     */
    private isFiltered(element: Element): boolean {
        // Checking tag content length limits
        const content = element.innerHTML || '';
        if (this.ruleAttributes.maxLength && this.ruleAttributes.maxLength > 0) {
            // If max-length is set - checking content length (it should be lesser than max length)
            if (content.length > this.ruleAttributes.maxLength) {
                return false;
            }
        }

        if (this.ruleAttributes.minLength && this.ruleAttributes.minLength > 0) {
            // If min-length is set - checking content length (it should be greater than min length)
            if (content.length < this.ruleAttributes.minLength) {
                return false;
            }
        }

        if (!this.ruleAttributes.tagContentFilter && !this.ruleAttributes.wildcard) {
            // Rule does not depend on content
            return true;
        }

        if (!content) {
            return false;
        }

        // Checking tag content against filter
        if (this.ruleAttributes.tagContentFilter && content.indexOf(this.ruleAttributes.tagContentFilter) < 0) {
            return false;
        }

        // Checking tag content against the wildcard
        if (this.ruleAttributes.wildcard && !this.ruleAttributes.wildcard.matches(content)) {
            return false;
        }

        // All filters are passed, tag is filtered
        return true;
    }

    /**
     * Searches for parent element.
     * Suitable parent elements are set by 'parent-elements' attribute.
     * If suitable element found - returns it. Otherwise - returns null.
     *
     * @param element Element evaluated against this rule.
     *
     * @returns Parent element.
     */
    private searchForParentElement(element: Element): Element | null {
        let parentElement = element.parentNode as Element;

        for (let i = 0; i < this.ruleAttributes.parentSearchLevel!; i += 1) {
            if (!parentElement) {
                return null;
            }

            if (this.ruleAttributes.parentElements!.indexOf(parentElement.tagName.toLowerCase()) > 0) {
                return parentElement;
            }

            parentElement = parentElement.parentNode as Element;
        }

        return null;
    }
}
