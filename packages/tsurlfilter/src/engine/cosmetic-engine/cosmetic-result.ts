import { CosmeticStylesResult } from './cosmetic-styles-result';
import { CosmeticScriptsResult } from './cosmetic-scripts-result';
import { type CosmeticRule } from '../../rules/cosmetic-rule';
import { CosmeticHtmlResult } from './cosmetic-html-result';

/**
 * @typedef {import('./cosmetic-engine').CosmeticEngine} CosmeticEngine
 */

/**
 * Cosmetic result is the representation of rules
 * It is primarily used by the {@link CosmeticEngine}.
 */
export class CosmeticResult {
    /**
     * Storage of element hiding rules.
     */
    public elementHiding: CosmeticStylesResult;

    /**
     * Storage of CSS rules.
     */
    public CSS: CosmeticStylesResult;

    /**
     * Storage of JS rules.
     */
    public JS: CosmeticScriptsResult;

    /**
     * Storage of Html filtering rules.
     */
    public Html: CosmeticHtmlResult;

    /**
     * Constructor.
     */
    constructor() {
        this.elementHiding = new CosmeticStylesResult();
        this.CSS = new CosmeticStylesResult();
        this.JS = new CosmeticScriptsResult();
        this.Html = new CosmeticHtmlResult();
    }

    /**
     * Script rules.
     *
     * @returns Array of cosmetic **JavaScript** rules.
     */
    public getScriptRules(): CosmeticRule[] {
        return this.JS.getRules();
    }
}
