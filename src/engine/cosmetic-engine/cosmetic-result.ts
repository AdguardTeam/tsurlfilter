import { CosmeticStylesResult } from './cosmetic-styles-result';
import { CosmeticScriptsResult } from './cosmetic-scripts-result';

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
}
