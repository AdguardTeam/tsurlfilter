import { CosmeticStylesResult } from './cosmetic-styles-result';
import { CosmeticScriptsResult } from './cosmetic-scripts-result';

export class CosmeticResult {
    public elementHiding: CosmeticStylesResult;

    public CSS: CosmeticStylesResult;

    public JS: CosmeticScriptsResult;

    constructor() {
        this.elementHiding = new CosmeticStylesResult();
        this.CSS = new CosmeticStylesResult();
        this.JS = new CosmeticScriptsResult();
    }
}
