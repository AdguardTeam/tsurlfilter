/**
 * Encapsulates document element matching
 */
export class HtmlRuleSelector {
    /**
     * Html Rule parse result
     */
    rule;

    /**
     * Constructor
     *
     * @param parsedHtmlRule
     */
    constructor(parsedHtmlRule) {
        this.rule = parsedHtmlRule;
    }

    /**
     * Returns matched elements for provided html rule
     *
     * @param doc
     * @return {null}
     */
    getMatchedElements(doc) {
        const elements = doc.querySelectorAll(this.rule.selector);

        let result = null;

        for (let i = 0; i < elements.length; i += 1) {
            const element = elements[i];

            let elementToDelete = null;

            if (this.isFiltered(element)) {
                if (this.rule.parentElements) {
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
                    result.push(element);
                }
            }
        }

        return result;
    }

    /**
     * Checks if element is filtered by provided rule
     *
     * @param element
     * @return {boolean}
     */
    isFiltered(element) {
        // Checking tag content length limits
        const content = element.innerHTML || '';
        if (this.rule.maxLength > 0) {
            // If max-length is set - checking content length (it should be lesser than max length)
            if (content.length > this.rule.maxLength) {
                return false;
            }
        }

        if (this.rule.minLength > 0) {
            // If min-length is set - checking content length (it should be greater than min length)
            if (content.length < this.rule.minLength) {
                return false;
            }
        }

        if (!this.rule.tagContentFilter && !this.rule.wildcard) {
            // Rule does not depend on content
            return true;
        }

        if (!content) {
            return false;
        }

        // Checking tag content against filter
        if (this.rule.tagContentFilter && content.indexOf(this.rule.tagContentFilter) < 0) {
            return false;
        }

        // Checking tag content against the wildcard
        if (this.rule.wildcard && !this.rule.wildcard.matches(content)) {
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
    searchForParentElement(element) {
        if (!this.rule.parentElements || this.rule.parentElements.length === 0) {
            return null;
        }

        let parentElement = element.parentNode;

        for (let i = 0; i < this.rule.parentSearchLevel; i += 1) {
            if (!parentElement) {
                return null;
            }

            if (this.rule.parentElements.indexOf(parentElement.tagName.toLowerCase()) > 0) {
                return parentElement;
            }

            parentElement = parentElement.parentNode;
        }

        return null;
    }
}
