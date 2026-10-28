import { CssHitsCounter } from '../../common/content-script/css-hits-counter';
import { sendAppMessage } from '../../common/content-script/send-app-message';
import { type ContentScriptCosmeticData } from '../../common/cosmetic-api';
import { MessageType } from '../../common/message-constants';
import { validateSelectors } from '../../common/utils/selector-validator';
import { HIDING_STYLE } from '../common/hidden-style';

import { ElementCollapser } from './element-collapser';

/**
 * This class applies cosmetic rules in page context.
 */
export class CosmeticController {
    /**
     * Retry timeout for {@link MessageType.GetCosmeticData} request to background in milliseconds.
     */
    private static GET_COSMETIC_DATA_RETRY_TIMEOUT_MS = 100;

    /**
     * Max {@link MessageType.GetCosmeticData} request limit.
     */
    private static MAX_GET_COSMETIC_DATA_TRIES = 200;

    /**
     * Number of {@link MessageType.GetCosmeticData} requests.
     */
    private tries = 0;

    /**
     * Creates new {@link CosmeticController} instance.
     */
    constructor() {
        this.process = this.process.bind(this);
    }

    /**
     * Init cosmetic processing.
     */
    public init(): void {
        const elementCollapser = new ElementCollapser();
        elementCollapser.start();
        this.process();
    }

    /**
     * Sends {@link MessageType.GetCosmeticData} message to background and process response.
     */
    private async process(): Promise<void> {
        const res = await sendAppMessage({
            type: MessageType.GetCosmeticData,
            payload: {
                documentUrl: window.location.href,
            },
        });

        if (res) {
            this.applyCosmetic(res);
        }
    }

    /**
     * Process {@link MessageType.GetCosmeticData} response from background.
     *
     * If {@link cosmeticData.isAppStarted} is false, retry the request after
     * {@link CosmeticController.GET_COSMETIC_DATA_RETRY_TIMEOUT_MS}
     * milliseconds. Otherwise repair native CSS selectors and enable the
     * native {@link CssHitsCounter} if
     * {@link cosmeticData.areHitsStatsCollected} is true.
     *
     * ExtendedCSS rules are applied by the background, so
     * {@link cosmeticData.extCssRules} is not used here.
     *
     * @param cosmeticData Response cosmetic data from background.
     */
    private applyCosmetic(cosmeticData: ContentScriptCosmeticData): void {
        const {
            isAppStarted,
            areHitsStatsCollected,
            nativeCssSelectors,
        } = cosmeticData;

        if (!isAppStarted
            && this.tries <= CosmeticController.MAX_GET_COSMETIC_DATA_TRIES
        ) {
            this.tries += 1;

            setTimeout(
                this.process,
                CosmeticController.GET_COSMETIC_DATA_RETRY_TIMEOUT_MS,
            );
            return;
        }

        if (areHitsStatsCollected) {
            CosmeticController.createCssHitsCounter();
        }

        CosmeticController.repairNativeCss(nativeCssSelectors);
    }

    /**
     * Validates native CSS element-hiding selectors and injects a corrective
     * `<style>` element containing only the valid ones if any invalid selectors
     * are found.
     *
     * The background already injected grouped native CSS via the browser API.
     * When any selector in a group is invalid, the browser drops the entire
     * group. This method validates all selectors and, if any are invalid,
     * re-injects only the valid selectors individually to restore correct filtering.
     *
     * @param selectors Individual native CSS element-hiding selectors.
     */
    private static repairNativeCss(selectors: string[] | null): void {
        if (!selectors || selectors.length === 0) {
            return;
        }

        const { valid, invalid } = validateSelectors(selectors);

        if (invalid.length === 0) {
            return;
        }

        if (valid.length === 0) {
            return;
        }

        const style = document.createElement('style');
        style.setAttribute('type', 'text/css');
        style.textContent = valid
            .map((sel) => `${sel} ${HIDING_STYLE}`)
            .join('\n');
        (document.head || document.documentElement).appendChild(style);
    }

    /**
     * Create new {@link CssHitsCounter} instance.
     *
     * @returns CssHitsCounter instance.
     */
    private static createCssHitsCounter(): CssHitsCounter {
        return new CssHitsCounter((stats) => {
            sendAppMessage({
                type: MessageType.SaveCssHitsStats,
                payload: stats,
            });
        });
    }
}
