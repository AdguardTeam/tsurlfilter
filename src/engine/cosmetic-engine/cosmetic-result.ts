import { CosmeticStylesResult } from './cosmetic-styles-result';
import { CosmeticScriptsResult } from './cosmetic-scripts-result';

export class CosmeticResult {
    public elementHiding: CosmeticStylesResult;

    private CSS: CosmeticStylesResult;

    private JS: CosmeticScriptsResult;

    constructor() {
        this.elementHiding = new CosmeticStylesResult();
        this.CSS = new CosmeticStylesResult();
        this.JS = new CosmeticScriptsResult();
    }
}
