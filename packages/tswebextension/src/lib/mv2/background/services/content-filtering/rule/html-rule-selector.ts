import {
    type HtmlSelectorList,
    type HtmlSelector,
    type HtmlSpecialSelector,
    HtmlSpecialSelectorName,
} from '@adguard/tsurlfilter';

import { logger } from '../../../../../common/utils/logger';

/**
 * Encapsulates document element matching.
 */
export class HtmlRuleSelector {
    /**
     * HTML filtering rule selector list.
     */
    private selectorList: HtmlSelectorList;

    /**
     * Constructor.
     *
     * @param selectorList HTML filtering rule selector list.
     */
    constructor(selectorList: HtmlSelectorList) {
        this.selectorList = selectorList;
    }

    /**
     * Returns elements matched by provided html rule.
     *
     * @param doc Document object.
     *
     * @returns Array of elements.
     */
    public getMatchedElements(doc: Document): Element[] {
        const result: Set<Element> = new Set();

        for (const complexSelector of this.selectorList.selectors) {
            // It should not happen, but just in case check for empty selectors
            if (complexSelector.length === 0) {
                logger.warn('[tsweb.HtmlRuleSelector.getMatchedElements]: Empty complex selector encountered');
                continue;
            }

            // It should not happen, but just in case check for combinators in the first selector
            if (complexSelector[0].combinator) {
                logger.warn('[tsweb.HtmlRuleSelector.getMatchedElements]: Combinator in the first selector encountered');
                continue;
            }

            /**
             * Each selector in complex selector we dive through the matched elements of the previous selector
             * starting from document for the first selector and filtering the matched elements on each step.
             */
            let currentContainers: Set<Element> = new Set([doc.documentElement]);
            for (const selector of complexSelector) {
                const nextContainers: Set<Element> = new Set();

                for (const container of currentContainers) {
                    const matchedElements = HtmlRuleSelector
                        .queryContainer(container, selector)
                        .filter((element) => HtmlRuleSelector.matchesSelector(element, selector));
                    matchedElements.forEach((element) => nextContainers.add(element));
                }

                currentContainers = nextContainers;
            }

            // We are sure that currentContainers contains only Elements here
            currentContainers.forEach((element) => result.add(element));
        }

        return Array.from(result);
    }

    /**
     * Queries the container with provided selector.
     *
     * @param container Container element or document.
     * @param selector HTML selector.
     *
     * @returns Array of matched elements.
     */
    private static queryContainer(
        container: Element,
        selector: HtmlSelector,
    ): Element[] {
        // Special case: If we are in the first selector and nativeSelector is empty,
        // we should leave check to special selectors, we are sure that special selectors exist
        // because AGTree wouldn't allow creation of empty selectors.
        // This can happen with rules like `example.org$$:contains(...)`
        if (!selector.combinator && !selector.nativeSelector) {
            return [container];
        }

        // Special case: If we are in the second or later selector and nativeSelector is empty,
        // we should match anything according to combinator and leave check to special selectors,
        // we are sure that special selectors exist because AGTree wouldn't allow creation of empty selectors.
        // This can happen with rules like: `example.org$$div :contains(...)`, `example.org$$div > :contains(...)`
        // `example.org$$div + :contains(...)`, `example.org$$div ~ :contains(...)`
        let { nativeSelector } = selector;
        if (selector.nativeSelector === '') {
            nativeSelector = '*';
        }

        // if no combinator is specified, it means that it's the first selector and container is document
        // descendant combinator can be queried directly
        if (!selector.combinator || selector.combinator === ' ') {
            return Array.from(container.querySelectorAll(nativeSelector));
        }

        // child combinator needs special handling with :scope
        if (selector.combinator === '>') {
            return Array.from(container.querySelectorAll(`:scope > ${nativeSelector}`));
        }

        // Unknown combinator
        if (selector.combinator !== '+' && selector.combinator !== '~') {
            return [];
        }

        // It can happen only when previous selector matched the document itself
        // For example, with rule like `example.org$$:contains(...) + div`
        // In this case, there are no siblings to match against, so we return an empty array
        if (!container.parentElement) {
            return [];
        }

        // Note: we can't use `:scope ~ selector` or `:scope + selector` because
        // of how `querySelectorAll` works. It would select all matching siblings
        // of the container's parent, not just the ones after the container.
        // So we need to manually find the siblings.

        const parentChildren = Array.from(container.parentElement.children);
        const indexOfContainerInParent = parentChildren.indexOf(container);

        if (selector.combinator === '+') {
            const nextSibling = parentChildren[indexOfContainerInParent + 1];

            // No next sibling or next sibling does not match
            if (!nextSibling || !nextSibling.matches(nativeSelector)) {
                return [];
            }

            return [nextSibling];
        }

        // General sibling combinator
        const matchedSiblings: Element[] = [];
        for (let i = indexOfContainerInParent + 1; i < parentChildren.length; i += 1) {
            const sibling = parentChildren[i];
            if (sibling.matches(nativeSelector)) {
                matchedSiblings.push(sibling);
            }
        }
        return matchedSiblings;
    }

    /**
     * Checks whether the element is filtered by the special selectors.
     *
     * @param element Element to check.
     * @param selector HTML selector to check against.
     *
     * @returns True if the element is filtered, false otherwise.
     */
    private static matchesSelector(
        element: Element,
        selector: HtmlSelector,
    ): boolean {
        // If there are no special selectors, the element matches
        if (selector.specialSelectors.length === 0) {
            return true;
        }

        // It should match all special selectors
        return selector.specialSelectors.every((specialSelector) => (
            HtmlRuleSelector.matchesSpecialSelector(element, specialSelector)
        ));
    }

    /**
     * Checks whether the element matches the special selector.
     *
     * @param element Element to check.
     * @param specialSelector Special selector to check against.
     *
     * @returns True if the element matches, false otherwise.
     */
    private static matchesSpecialSelector(
        element: Element,
        specialSelector: HtmlSpecialSelector,
    ): boolean {
        const { name, value } = specialSelector;

        if (name === HtmlSpecialSelectorName.Contains) {
            const content = element.innerHTML || '';
            if (!content) {
                return false;
            }

            return typeof value === 'string'
                ? content.includes(value)
                : value.test(content);
        }

        // Unknown special selector
        logger.warn(`[tsweb.HtmlRuleSelector.matchesSpecialSelector]: Unknown special selector: ${name}`);
        return false;
    }
}
