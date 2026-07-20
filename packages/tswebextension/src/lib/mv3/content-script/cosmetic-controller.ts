import { CssHitsCounter } from '../../common/content-script/css-hits-counter';
import { sendAppMessage } from '../../common/content-script/send-app-message';
import { MessageType } from '../../common/message-constants';
import { validateSelectors } from '../../common/utils/selector-validator';
import { HIDING_STYLE } from '../../mv2/common/hidden-style';

/**
 * This class applies cosmetic rules in page context.
 *
 * ExtendedCSS rules are applied directly from the MV3 background service worker
 * via `chrome.scripting.executeScript` (see `CosmeticApi.applyCosmeticRules`).
 * The content script is responsible only for:
 * - repairing invalid grouped native CSS selectors that the background
 *   injected via the browser CSS API;
 * - counting native CSS hits statistics (the background adds `--adguard-hit`
 *   markers to native CSS when statistics are enabled, and the content
 *   script's {@link CssHitsCounter} reads them from computed styles).
 */
export class CosmeticController {
    /**
     * Retry timeout for {@link MessageType.GetCosmeticData} request to the
     * background, in milliseconds.
     */
    private static readonly GET_COSMETIC_DATA_RETRY_TIMEOUT_MS = 100;

    /**
     * Max number of {@link MessageType.GetCosmeticData} retries before giving
     * up. At {@link GET_COSMETIC_DATA_RETRY_TIMEOUT_MS} intervals this covers
     * ~20s of startup.
     */
    private static readonly MAX_GET_COSMETIC_DATA_TRIES = 200;

    /**
     * Number of {@link MessageType.GetCosmeticData} requests sent so far.
     */
    private static tries = 0;

    /**
     * Module that collects statistics about the usage of native CSS rules.
     * Created at most once per document (see {@link process}).
     */
    private static cssHitsCounter?: CssHitsCounter;

    /**
     * Init cosmetic processing.
     */
    public static init(): void {
        CosmeticController.process();
    }

    /**
     * Sends {@link MessageType.GetCosmeticData} message to background and
     * repairs native CSS selectors if any are invalid.
     *
     * The background engine may not be started yet when the content script
     * loads (a common startup race — the service worker is still
     * initializing). In that case the response is `undefined` (the message
     * handler returns nothing until the engine is started). This method
     * retries after {@link GET_COSMETIC_DATA_RETRY_TIMEOUT_MS} until the engine
     * reports `isAppStarted`, so the native-CSS repair — which only the
     * content script can perform — is not permanently skipped for documents
     * that loaded during startup. Without this retry, an invalid grouped
     * native selector dropped by the browser would never be re-injected for
     * such pages.
     */
    private static async process(): Promise<void> {
        const res = await sendAppMessage({
            type: MessageType.GetCosmeticData,
            payload: {
                documentUrl: window.location.href,
            },
        });

        // Retry while the background engine is not ready (startup race).
        // The response is `undefined` until `tsWebExtension.isStarted`, and
        // `isAppStarted` is false until the app finishes initializing.
        if ((!res || !res.isAppStarted)
            && CosmeticController.tries < CosmeticController.MAX_GET_COSMETIC_DATA_TRIES
        ) {
            CosmeticController.tries += 1;
            setTimeout(
                CosmeticController.process,
                CosmeticController.GET_COSMETIC_DATA_RETRY_TIMEOUT_MS,
            );
            return;
        }

        if (res) {
            // Native-only CSS hits counting: reads the `--adguard-hit`
            // custom property from computed styles. Extended-CSS-rule hits
            // are reported separately by the background-injected `applyExtCss`
            // callback, so this counter reads ONLY native CSS markers.
            // Created at most once per document — repeated `process()` runs
            // (e.g. after retries or re-init) must not duplicate the counter
            // and its MutationObserver.
            if (res.areHitsStatsCollected && !CosmeticController.cssHitsCounter) {
                CosmeticController.cssHitsCounter = CosmeticController.createCssHitsCounter();
            }

            CosmeticController.repairNativeCss(res.nativeCssSelectors);
        }
    }

    /**
     * Creates a new {@link CssHitsCounter} instance reporting counted hits
     * to the background.
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
}
