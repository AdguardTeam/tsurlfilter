import { CosmeticStylesResult } from './cosmetic-styles-result';
import { CosmeticScriptsResult } from './cosmetic-scripts-result';
import { CosmeticRule } from '../../rules/cosmetic-rule';

/**
 * Cosmetic result is the representation of rules
 * It is primarily used by the {@see CosmeticEngine}
 */
export class CosmeticResult {
    /**
     * Storage of element hiding rules
     */
    public elementHiding: CosmeticStylesResult;

    /**
     * Storage of CSS rules
     */
    public CSS: CosmeticStylesResult;

    /**
     * Storage of JS rules
     */
    public JS: CosmeticScriptsResult;

    constructor() {
        this.elementHiding = new CosmeticStylesResult();
        this.CSS = new CosmeticStylesResult();
        this.JS = new CosmeticScriptsResult();
    }

    /**
     * Rules of current cosmetic result
     */
    public getRules(): CosmeticRule[] {
        return [...this.elementHiding.getRules(), ...this.CSS.getRules(), ...this.JS.getRules()];
    }
}
