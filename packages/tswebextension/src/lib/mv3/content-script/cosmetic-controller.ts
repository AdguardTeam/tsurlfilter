import { sendAppMessage } from '../../common/content-script/send-app-message';
import { MessageType } from '../../common/message-constants';
import { validateSelectors } from '../../common/utils/selector-validator';
import { HIDING_STYLE } from '../../mv2/common/hidden-style';

/**
 * This class applies cosmetic rules in page context.
 *
 * ExtendedCSS rules are applied directly from the MV3 background service worker
 * via `chrome.scripting.executeScript` (see `CosmeticApi.applyCosmeticRules`).
 * The content script is responsible only for repairing invalid grouped native
 * CSS selectors that the background injected via the browser CSS API.
 */
export class CosmeticController {
    /**
     * Init cosmetic processing.
     */
    public static init(): void {
        CosmeticController.process();
    }

    /**
     * Sends {@link MessageType.GetCosmeticData} message to background and
     * repairs native CSS selectors if any are invalid.
     */
    private static async process(): Promise<void> {
        const res = await sendAppMessage({
            type: MessageType.GetCosmeticData,
            payload: {
                documentUrl: window.location.href,
            },
        });

        if (res) {
            CosmeticController.repairNativeCss(res.nativeCssSelectors);
        }
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
