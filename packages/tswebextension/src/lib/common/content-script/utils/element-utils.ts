import { type RuleInfoBasic } from '../../rule-info';

import { cssHitsHelpers } from './css-hits-helpers';

/**
 * Utils class.
 */
export class ElementUtils {
    /**
     * Serialize HTML element.
     *
     * Delegates to {@link cssHitsHelpers.elementToString} so that MV2 and the
     * MV3 inlined path share one implementation.
     *
     * @param element Element to serialize.
     *
     * @returns String representation of the element.
     */
    public static elementToString(element: Element): string {
        return cssHitsHelpers.elementToString(element);
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
     * Delegates to {@link cssHitsHelpers.parseInfo} so that MV2 and the
     * MV3 inlined path share one implementation.
     *
     * @param content Style content.
     * @param attributeMarker Attribute marker.
     *
     * @returns Rule info or null.
     */
    public static parseInfo(content: string, attributeMarker: string): RuleInfoBasic | null {
        return cssHitsHelpers.parseInfo(content, attributeMarker);
    }

    /**
     * Parses hits info from style content.
     *
     * Delegates to {@link cssHitsHelpers.parseExtendedStyleInfo} so that MV2
     * and the MV3 inlined path share one implementation.
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
        return cssHitsHelpers.parseExtendedStyleInfo(content, attributeMarker);
    }
}
