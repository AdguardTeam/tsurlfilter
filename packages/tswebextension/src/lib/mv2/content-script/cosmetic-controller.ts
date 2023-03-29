import {
    type IAffectedElement,
    type ExtCssConfiguration,
    ExtendedCss,
} from '@adguard/extended-css';

import { CssHitsCounter } from './css-hits-counter';
import { MessageType } from '../../common/message-constants';
import { sendAppMessage } from '../../common/content-script/send-app-message';
import { ElementCollapser } from './element-collapser';

// TODO: Move to shared 'messages' module, when it will be implemented
import type { ContentScriptCosmeticData } from '../background/cosmetic-api';

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
     * Module that collects statistics about the usage of CSS rules.
     */
    private cssHitsCounter?: CssHitsCounter;

    /**
     * Creates new {@link CosmeticController} instance.
     */
    constructor() {
        this.process = this.process.bind(this);
        this.beforeStyleApplied = this.beforeStyleApplied.bind(this);
    }

    /**
     * Init cosmetic processing.
     */
    public init(): void {
        ElementCollapser.start();
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
     * If {@link cosmeticData.isAppStarted} is false, retry
     * request after {@link GET_COSMETIC_DATA_RETRY_TIMEOUT_MS} milliseconds.
     * Else apply extended css rules from {@link cosmeticData.extCssText}
     * and enable {@link CssHitsCounter} if {@link cosmeticData.areHitsStatsCollected} is true.
     *
     * @param cosmeticData Response cosmetic data from background.
     */
    private applyCosmetic(cosmeticData: ContentScriptCosmeticData): void {
        const {
            isAppStarted,
            extCssRules,
            areHitsStatsCollected,
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
            this.cssHitsCounter = CosmeticController.createCssHitsCounter();
        }

        if (!extCssRules || extCssRules.length === 0) {
            return;
        }

        const extendedCssConfig: ExtCssConfiguration = {
            cssRules: extCssRules,
        };

        if (areHitsStatsCollected) {
            extendedCssConfig.beforeStyleApplied = this.beforeStyleApplied;
        }

        const extendedCss = new ExtendedCss(extendedCssConfig);
        extendedCss.apply();
    }

    /**
     * Preprocess {@link IAffectedElement} for {@link ExtendedCss} instance.
     *
     * @param el Record with required 'content' style property in rules.
     * @returns Affected element record.
     */
    private beforeStyleApplied(el: IAffectedElement): IAffectedElement {
        if (!this.cssHitsCounter) {
            return el;
        }

        return this.cssHitsCounter.countAffectedByExtendedCss(el);
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
