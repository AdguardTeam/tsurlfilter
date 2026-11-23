import { CosmeticControllerCommon } from '../../common/content-script/cosmetic-controller';

import { ElementCollapser } from './element-collapser';

/**
 * This class applies cosmetic rules in page context.
 */
export class CosmeticController extends CosmeticControllerCommon {
    /**
     * Init cosmetic processing.
     */
    public init(): void {
        const elementCollapser = new ElementCollapser();
        elementCollapser.start();
        super.init();
    }
}
