import { type ExtCssConfiguration, ExtendedCss, type IAffectedElement } from '@adguard/extended-css';

import { HIDING_STYLE } from '../../mv2/common/hidden-style';
import { type ContentScriptCosmeticData } from '../cosmetic-api';
import { MessageType } from '../message-constants';
import { validateSelectors } from '../utils/selector-validator';

import { CollectHitStatsListener } from './collect-hit-stats';
import { CssHitsCounter } from './css-hits-counter';
import { PendingProbesCollector } from './pending-probes-collector';
import { sendAppMessage } from './send-app-message';

/**
 * Shared cosmetic controller lifecycle.
 *
 * MV2 and MV3 controllers differ only in the platform-specific injectors, so
 * the cosmetic data application and the CSS hits counter lifecycle live here.
 */
export class CosmeticControllerCommon {
    /**
     * Retry timeout for {@link MessageType.GetCosmeticData} request to
     * background in milliseconds.
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
     * Number of reapply requests made after collection was enabled.
     */
    private reapplyTries = 0;

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
     * Whether the cosmetic data response has been applied.
     */
    private cosmeticDataApplied = false;

    /**
     * Whether the applied cosmetic data contains hit markers and the counter
     * hook is attached.
     */
    private hitsMarkersApplied = false;

    /**
     * Whether a marked-data reapply request is in flight.
     */
    private reapplyInFlight = false;

    /**
     * Whether an enable arrived while a reapply request was in flight.
     */
    private reapplyRequested = false;

    /**
     * ExtendedCss instance whose rules are currently applied.
     */
    private extendedCss?: ExtendedCss;

    /**
     * Creates a new {@link CosmeticControllerCommon}.
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

        // Start observing the DOM before the asynchronous cosmetic data
        // request, so that elements created and removed during the document
        // loading are not missed by the CSS hits counter.
        this.pendingProbesCollector.start();
        this.process();
    }

    /**
     * Sends a {@link MessageType.GetCosmeticData} message to the background and
     * processes the response.
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
        } catch {
            // Keep collecting probes while a retry can still succeed.
            if (this.tries <= CosmeticControllerCommon.MAX_GET_COSMETIC_DATA_TRIES) {
                this.tries += 1;
                setTimeout(
                    this.process,
                    CosmeticControllerCommon.GET_COSMETIC_DATA_RETRY_TIMEOUT_MS,
                );
                return;
            }
        }

        // Without a response the counter is never created, so the collected
        // probes will never be counted: stop observing the DOM.
        this.pendingProbesCollector.stop();
    }

    /**
     * Applies a {@link MessageType.GetCosmeticData} response.
     *
     * @param cosmeticData Response cosmetic data from the background.
     */
    private applyCosmetic(cosmeticData: ContentScriptCosmeticData): void {
        const {
            isAppStarted,
            extCssRules,
            areHitsStatsCollected,
            areNativeHitsStatsCollected,
            nativeCssSelectors,
        } = cosmeticData;

        if (!isAppStarted
            && this.tries <= CosmeticControllerCommon.MAX_GET_COSMETIC_DATA_TRIES
        ) {
            this.tries += 1;

            setTimeout(
                this.process,
                CosmeticControllerCommon.GET_COSMETIC_DATA_RETRY_TIMEOUT_MS,
            );
            return;
        }

        const collectStats = this.collectHitStatsEnabled ?? areHitsStatsCollected;

        if (collectStats || areHitsStatsCollected) {
            // A paused counter is needed when the data has markers but
            // collection is off: the hook must blank them without reporting.
            // It is also used while marked data is being requested.
            this.ensureCounter(!collectStats || !areHitsStatsCollected);
        } else {
            this.pendingProbesCollector.stop();
        }

        this.cosmeticDataApplied = true;

        CosmeticControllerCommon.repairNativeCss(nativeCssSelectors);
        this.applyExtendedCssRules(extCssRules, !!this.cssHitsCounter);
        this.hitsMarkersApplied = areHitsStatsCollected
            && areNativeHitsStatsCollected
            && !!this.cssHitsCounter;

        // A state message may arrive before the cosmetic data response. When
        // it enabled collection and either the ExtendedCss rules or the native
        // CSS was built without markers, ask the background for a marked copy.
        if (collectStats && (!areHitsStatsCollected || !areNativeHitsStatsCollected)) {
            this.reapplyMarkedCosmeticData();
        }
    }

    /**
     * Applies a hit stats collection change received from the background.
     *
     * @param isCollectStats Whether CSS hits must be collected.
     */
    private onCollectHitStatsChange(isCollectStats: boolean): void {
        this.collectHitStatsEnabled = isCollectStats;

        if (!this.cssHitsCounter) {
            if (!isCollectStats) {
                this.pendingProbesCollector.stop();
                return;
            }

            if (!this.cosmeticDataApplied) {
                if (document.readyState === 'loading') {
                    // The counter is not created yet. Restart the collector
                    // only while it still covers the loading window.
                    this.pendingProbesCollector.start();
                }
                return;
            }

            this.reapplyMarkedCosmeticData();
            return;
        }

        if (isCollectStats) {
            // A previous reapply may have failed or been interrupted, leaving
            // a counter over unmarked CSS. Resume only when the markers are
            // actually applied.
            if (!this.hitsMarkersApplied) {
                this.reapplyMarkedCosmeticData();
                return;
            }

            this.cssHitsCounter.resume();
            return;
        }

        this.cssHitsCounter.pause();
    }

    /**
     * Requests marked cosmetic data from the background and re-applies it.
     *
     * Used when collection is enabled on an already-open page whose cosmetic
     * data was applied without hit markers.
     */
    private async reapplyMarkedCosmeticData(): Promise<void> {
        if (this.reapplyInFlight) {
            // Remember the enable so a failed or unmarked response can retry.
            if (this.isCollectHitStatsEnabled()) {
                this.reapplyRequested = true;
            }
            return;
        }

        // `null` means no state message has arrived yet. The initial response
        // can still contain marked data, so only an explicit disable stops
        // the reapply.
        if (!this.isCollectHitStatsEnabled()) {
            return;
        }

        this.reapplyInFlight = true;
        // Re-apply from a paused state so the counter does not scan the
        // unmarked data, and so the ExtendedCss hook can queue hits while the
        // marked rules are applied.
        this.cssHitsCounter?.pause();

        try {
            const res = await sendAppMessage({
                type: MessageType.GetCosmeticData,
                payload: {
                    documentUrl: window.location.href,
                    reapplyHits: true,
                },
            });

            if (!res) {
                this.pendingProbesCollector.stop();
                return;
            }

            if (!res.isAppStarted
                && this.reapplyTries <= CosmeticControllerCommon.MAX_GET_COSMETIC_DATA_TRIES) {
                this.reapplyTries += 1;
                setTimeout(
                    () => this.reapplyMarkedCosmeticData(),
                    CosmeticControllerCommon.GET_COSMETIC_DATA_RETRY_TIMEOUT_MS,
                );
                return;
            }

            if (!this.isCollectHitStatsEnabled()) {
                return;
            }

            if (!res.areHitsStatsCollected) {
                // The background considers collection disabled for this
                // frame, e.g. because the document is allowlisted. Keep any
                // ExtendedCss hits queued during the reapply pause.
                this.cssHitsCounter?.pause();
                this.pendingProbesCollector.stop();
                return;
            }

            if (!this.cssHitsCounter) {
                this.ensureCounter(true);
            }

            const hasMarkedExtendedCss = !!res.extCssRules && res.extCssRules.length > 0;
            const hasMarkedNativeCss = res.areNativeHitsStatsCollected;

            this.applyExtendedCssRules(res.extCssRules, true);
            this.hitsMarkersApplied = hasMarkedNativeCss;
            this.cosmeticDataApplied = true;
            this.reapplyTries = 0;

            if (document.readyState === 'loading') {
                this.pendingProbesCollector.start();
            }

            if (hasMarkedNativeCss || hasMarkedExtendedCss) {
                // ExtendedCss hits work without the native CSS injection.
                // Keep the flag false when native CSS failed so the next
                // enable retries it.
                this.cssHitsCounter?.resume();
            } else {
                this.pendingProbesCollector.stop();
            }
        } catch {
            // Keep the counter paused: without marked data there is nothing
            // to report, and a later toggle can retry.
            this.pendingProbesCollector.stop();
        } finally {
            this.reapplyInFlight = false;

            if (this.reapplyRequested) {
                this.reapplyRequested = false;

                if (this.isCollectHitStatsEnabled() && !this.hitsMarkersApplied) {
                    this.reapplyMarkedCosmeticData();
                }
            }
        }
    }

    /**
     * Whether collection is enabled or no state message has arrived yet.
     *
     * @returns False only after an explicit disable.
     */
    private isCollectHitStatsEnabled(): boolean {
        return this.collectHitStatsEnabled !== false;
    }

    /**
     * Creates the CSS hits counter if it does not exist yet.
     *
     * @param paused Whether the counter must start paused.
     */
    private ensureCounter(paused: boolean): void {
        if (this.cssHitsCounter) {
            return;
        }

        this.cssHitsCounter = new CssHitsCounter((stats) => {
            sendAppMessage({
                type: MessageType.SaveCssHitsStats,
                payload: stats,
            });
        }, {
            pendingProbesCollector: this.pendingProbesCollector,
            paused,
        });
    }

    /**
     * Disposes the previous ExtendedCss instance and applies new rules.
     *
     * @param extCssRules Extended CSS rules from the background.
     * @param withCounter Whether the hit counting hook must be attached.
     */
    private applyExtendedCssRules(
        extCssRules: string[] | null,
        withCounter: boolean,
    ): void {
        if (this.extendedCss) {
            this.extendedCss.dispose();
            this.extendedCss = undefined;
        }

        if (!extCssRules || extCssRules.length === 0) {
            return;
        }

        const extendedCssConfig: ExtCssConfiguration = {
            cssRules: extCssRules,
        };

        if (withCounter) {
            extendedCssConfig.beforeStyleApplied = this.beforeStyleApplied;
        }

        this.extendedCss = new ExtendedCss(extendedCssConfig);
        this.extendedCss.apply();
    }

    /**
     * Preprocesses {@link IAffectedElement} for the {@link ExtendedCss} instance.
     *
     * @param el Record with the required `content` style property of rules.
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
     * Validates native CSS element-hiding selectors and injects a corrective
     * `<style>` element containing only the valid ones if any invalid selectors
     * are found.
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
}
