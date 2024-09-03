/**
 * Checks whether the domElement is matched by absolute extended pseudo-class argument.
 *
 * @param domElement Page element.
 * @param pseudoName Pseudo-class name.
 * @param pseudoArg Pseudo-class arg.
 *
 * @returns True if `domElement` is matched by absolute pseudo-class.
 * @throws An error on unknown absolute pseudo-class.
 */
export declare const isMatchedByAbsolutePseudo: (domElement: Element, pseudoName: string, pseudoArg: string) => boolean;
export declare const findByAbsolutePseudoPseudo: {
    /**
     * Returns list of nth ancestors relative to every dom node from domElements list.
     *
     * @param domElements DOM elements.
     * @param rawPseudoArg Number arg of :nth-ancestor() or :upward() pseudo-class.
     * @param pseudoName Pseudo-class name.
     *
     * @returns Array of ancestor DOM elements.
     */
    nthAncestor: (domElements: HTMLElement[], rawPseudoArg: string, pseudoName: string) => HTMLElement[];
    /**
     * Returns list of elements by xpath expression, evaluated on every dom node from domElements list.
     *
     * @param domElements DOM elements.
     * @param rawPseudoArg Arg of :xpath() pseudo-class.
     *
     * @returns Array of DOM elements matched by xpath expression.
     */
    xpath: (domElements: HTMLElement[], rawPseudoArg: string) => HTMLElement[];
    /**
     * Returns list of closest ancestors relative to every dom node from domElements list.
     *
     * @param domElements DOM elements.
     * @param rawPseudoArg Standard selector arg of :upward() pseudo-class.
     *
     * @returns Array of closest ancestor DOM elements.
     * @throws An error if `rawPseudoArg` is not a valid standard selector.
     */
    upward: (domElements: HTMLElement[], rawPseudoArg: string) => HTMLElement[];
};
