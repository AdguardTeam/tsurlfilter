import { AnySelectorNodeInterface } from './nodes';
/**
 * Selects elements by ast.
 *
 * @param ast Ast of parsed selector.
 * @param doc Document.
 *
 * @returns Array of DOM elements.
 */
export declare const selectElementsByAst: (ast: AnySelectorNodeInterface, doc?: Document) => HTMLElement[];
/**
 * Selects elements by selector.
 *
 * @param selector Standard or extended selector.
 *
 * @returns Array of DOM elements.
 */
export declare const querySelectorAll: (selector: string) => HTMLElement[];
/**
 * Class of ExtCssDocument is needed for caching.
 * For making cache related to each new instance of class, not global.
 */
export declare class ExtCssDocument {
    /**
     * Cache with selectors and their AST parsing results.
     */
    private readonly astCache;
    /**
     * Creates new ExtCssDocument and inits new `astCache`.
     */
    constructor();
    /**
     * Saves selector and it's ast to cache.
     *
     * @param selector Standard or extended selector.
     * @param ast Selector ast.
     */
    private saveAstToCache;
    /**
     * Returns ast from cache for given selector.
     *
     * @param selector Standard or extended selector.
     *
     * @returns Previously parsed ast found in cache, or null if not found.
     */
    private getAstFromCache;
    /**
     * Returns selector ast:
     * - if cached ast exists — returns it;
     * - if no cached ast — saves newly parsed ast to cache and returns it.
     *
     * @param selector Standard or extended selector.
     *
     * @returns Ast for `selector`.
     */
    getSelectorAst(selector: string): AnySelectorNodeInterface;
    /**
     * Selects elements by selector.
     *
     * @param selector Standard or extended selector.
     *
     * @returns Array of DOM elements.
     */
    querySelectorAll(selector: string): HTMLElement[];
}
export declare const extCssDocument: ExtCssDocument;
