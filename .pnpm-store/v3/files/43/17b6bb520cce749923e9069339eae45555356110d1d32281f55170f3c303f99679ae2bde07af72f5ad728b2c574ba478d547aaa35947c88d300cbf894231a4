import { HtmlRuleAttributes } from './html-rule-attributes';

/**
 * Encapsulates document element matching
 */
export class HtmlRuleSelector {
    /**
     * Html Rule parse result
     */
    private ruleAttributes: HtmlRuleAttributes;

    /**
     * Constructor
     *
     * @param parsedHtmlRule
     */
    constructor(parsedHtmlRule: HtmlRuleAttributes) {
        this.ruleAttributes = parsedHtmlRule;
    }

    /**
     * Returns matched elements for provided html rule
     *
     * @param doc document object
     * @return Array of elements or null
     */
    public getMatchedElements(doc: HTMLDocument): Element[] | null {
        const elements = doc.querySelectorAll(this.ruleAttributes.selector!);

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
     * Checks if element is filtered by provided rule
     *
     * @param element to check
     * @return {boolean} is element filtered
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
     * Searches for parent element to delete.
     * Suitable parent elements are set by 'parent-elements' attribute.
     * If suitable element found - returns it. Otherwise - returns null.
     *
     * @param element Element evaluated against this rule
     * @return Parent element to be deleted
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
