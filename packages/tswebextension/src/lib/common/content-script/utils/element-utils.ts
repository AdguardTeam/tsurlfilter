import { type RuleInfoBasic } from '../../rule-info';

/**
 * Utils class.
 */
export class ElementUtils {
    /**
     * Serialize HTML element.
     *
     * @param element Element to serialize.
     *
     * @returns String representation of the element.
     */
    public static elementToString(element: Element): string {
        const s = [];

        s.push('<');
        s.push(element.localName);
        const { attributes } = element;
        for (let i = 0; i < attributes.length; i += 1) {
            const attr = attributes[i];
            s.push(' ');
            s.push(attr.name);
            s.push('="');
            const value = attr.value === null ? '' : attr.value.replace(/"/g, '\\"');
            s.push(value);
            s.push('"');
        }
        s.push('>');

        return s.join('');
    }

    /**
     * Appends node children to the array.
     *
     * @param node Element whose children we would like to add.
     * @param arrayWithNodes Array where we add children.
     */
    public static appendChildren(node: Element, arrayWithNodes: Element[]): void {
        const children = node.querySelectorAll('*');
        if (children && children.length > 0) {
            for (let i = 0; i < children.length; i += 1) {
                arrayWithNodes.push(children[i]);
            }
        }
    }

    /**
     * Adds elements into array if they are not in the array yet.
     *
     * @param targetArray Array where we add elements.
     * @param sourceArray Array with elements.
     */
    public static addUnique(targetArray: Element[], sourceArray: Element[]): void {
        if (sourceArray.length > 0) {
            for (let i = 0; i < sourceArray.length; i += 1) {
                const sourceElement = sourceArray[i];
                if (targetArray.indexOf(sourceElement) === -1) {
                    targetArray.push(sourceElement);
                }
            }
        }
    }

    /**
     * Removes all elements in array.
     *
     * @param elements Array with elements.
     */
    public static removeElements(elements: Element[]): void {
        for (let i = 0; i < elements.length; i += 1) {
            const element = elements[i];
            element.remove();
        }
    }

    /**
     * Parses hits info from style content.
     *
     * @param content Style content.
     * @param attributeMarker Attribute marker.
     *
     * @returns Rule info or null.
     */
    public static parseInfo(content: string, attributeMarker: string): RuleInfoBasic | null {
        if (!content || content.indexOf(attributeMarker) < 0) {
            return null;
        }

        let filterIdAndRuleText = decodeURIComponent(content);
        // 'content' value may include open and close quotes.
        filterIdAndRuleText = ElementUtils.removeQuotes(filterIdAndRuleText);
        // Remove prefix
        filterIdAndRuleText = filterIdAndRuleText.substring(attributeMarker.length);
        // Attribute 'content' in css looks like: {content: 'adguard{filterId};{ruleIndex}'}
        const index = filterIdAndRuleText.indexOf(';');
        if (index < 0) {
            return null;
        }

        const filterId = Number.parseInt(filterIdAndRuleText.slice(0, index), 10);
        if (Number.isNaN(filterId)) {
            return null;
        }

        const ruleIndex = Number.parseInt(filterIdAndRuleText.slice(index + 1), 10);
        if (Number.isNaN(ruleIndex)) {
            return null;
        }

        return { filterId, ruleIndex };
    }

    /**
     * Parses hits info from style content.
     *
     * @param content Style.
     * @param attributeMarker Attribute marker.
     *
     * @returns Rule info or null.
     */
    public static parseExtendedStyleInfo(
        content: string,
        attributeMarker: string,
    ): RuleInfoBasic | null {
        const important = '!important';
        const indexOfImportant = content.lastIndexOf(important);
        if (indexOfImportant === -1) {
            return ElementUtils.parseInfo(content, attributeMarker);
        }

        const contentWithoutImportant = content.substring(0, indexOfImportant).trim();
        return ElementUtils.parseInfo(contentWithoutImportant, attributeMarker);
    }

    /**
     * Unquotes specified value.
     *
     * @param value Value to unquote.
     *
     * @returns Unquoted value.
     */
    private static removeQuotes(value: string): string {
        if (value.length > 1
            && ((value[0] === '"' && value[value.length - 1] === '"')
                || (value[0] === '\'' && value[value.length - 1] === '\''))) {
            // Remove double-quotes or single-quotes
            return value.substring(1, value.length - 1);
        }

        return value;
    }
}
