import { type ExtCssConfiguration, ExtendedCss, type IAffectedElement } from '@adguard/extended-css';

import { CollectHitStatsListener } from '../../common/content-script/collect-hit-stats';
import { CssHitsCounter } from '../../common/content-script/css-hits-counter';
import { PendingProbesCollector } from '../../common/content-script/pending-probes-collector';
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
     * Module that collects statistics about the usage of CSS rules.
     */
    private cssHitsCounter?: CssHitsCounter;

    /**
     * Collects short-lived elements created before the counter initialization.
     */
    private pendingProbesCollector = new PendingProbesCollector();

    /**
     * Latest hit stats collection state received from the background.
     *
     * `null` means that no update has been received yet, so the state from
     * {@link ContentScriptCosmeticData.areHitsStatsCollected} is used.
     */
    private collectHitStatsEnabled: boolean | null = null;

    /**
     * Creates new {@link CosmeticController} instance.
     */
    constructor() {
        this.process = this.process.bind(this);
        this.beforeStyleApplied = this.beforeStyleApplied.bind(this);
        this.onCollectHitStatsChange = this.onCollectHitStatsChange.bind(this);
    }

    /**
     * Init cosmetic processing.
     */
    public init(): void {
        CollectHitStatsListener.listen(this.onCollectHitStatsChange);

        const elementCollapser = new ElementCollapser();
        elementCollapser.start();
        // Start observing the DOM before the asynchronous cosmetic data
        // request, so that elements created and removed during the document
        // loading are not missed by the CSS hits counter.
        this.pendingProbesCollector.start();
        this.process();
    }

    /**
     * Sends {@link MessageType.GetCosmeticData} message to background and process response.
     */
    private async process(): Promise<void> {
        try {
            const res = await sendAppMessage({
                type: MessageType.GetCosmeticData,
                payload: {
                    documentUrl: window.location.href,
                },
            });

            if (res) {
                this.applyCosmetic(res);
                return;
            }
        } catch (e) {
            this.pendingProbesCollector.stop();
            throw e;
        }

        // Without a response the counter is never created, so the collected
        // probes will never be counted: stop observing the DOM.
        this.pendingProbesCollector.stop();
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
            this.cssHitsCounter = CosmeticController.createCssHitsCounter(
                this.pendingProbesCollector,
            );

            if (this.collectHitStatsEnabled === false) {
                this.cssHitsCounter.pause();
            }
        } else {
            this.pendingProbesCollector.stop();
        }

        CosmeticController.repairNativeCss(nativeCssSelectors);

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
     * Applies a hit stats collection change received from the background.
     *
     * @param isCollectStats Whether CSS hits must be collected.
     */
    private onCollectHitStatsChange(isCollectStats: boolean): void {
        this.collectHitStatsEnabled = isCollectStats;

        if (!this.cssHitsCounter) {
            if (isCollectStats) {
                // The counter is not created yet. Restart the collector only
                // while it still covers the loading window.
                if (document.readyState === 'loading') {
                    this.pendingProbesCollector.start();
                }
            } else {
                this.pendingProbesCollector.stop();
            }

            return;
        }

        if (isCollectStats) {
            this.cssHitsCounter.resume();
            return;
        }

        this.cssHitsCounter.pause();
    }

    /**
     * Preprocess {@link IAffectedElement} for {@link ExtendedCss} instance.
     *
     * @param el Record with required 'content' style property in rules.
     *
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
     * @param pendingProbesCollector Collector of short-lived elements.
     *
     * @returns CssHitsCounter instance.
     */
    private static createCssHitsCounter(pendingProbesCollector: PendingProbesCollector): CssHitsCounter {
        return new CssHitsCounter((stats) => {
            sendAppMessage({
                type: MessageType.SaveCssHitsStats,
                payload: stats,
            });
        }, { pendingProbesCollector });
    }
}
