import browser from 'webextension-polyfill';

// Import directly from the file: the content script bundle must not pull the background code.
import { CanvasDeliveryGuard, CanvasDeliveryUrl } from '../common/canvas-delivery';

/**
 * Feature policy of a document, missing from the DOM types in use.
 */
type FeaturePolicy = {
    allowsFeature(feature: string): boolean;
};

/**
 * Delivers canvas protection in Chromium MV2 before page scripts run. Chromium MV2 cannot
 * register page-world scripts, and `tabs.executeScript` lands after the first page scripts,
 * so the content script fetches the page script from the background page with one synchronous
 * request and inserts it as an inline script. Documents it skips get the code injected
 * by the background page when they commit.
 *
 * The content script cannot know whether the document is protected, so it sends the request
 * in every web document, whether protection is on or off. The request is asynchronous only
 * when the document already got the script, is an XML document or forbids `sync-xhr`.
 * The background page answers only the first request of a document, so a page script
 * repeating the request fails as it would without the extension.
 *
 * Chromium before 106 has no `documentId` in `webRequest`, so the background page cannot tell
 * documents apart and cancels every request. The content script sends none there, and
 * documents get the code injected on commit.
 *
 * TODO: remove when Chromium MV2 is no longer supported.
 */
export class CanvasProtectionDelivery {
    /**
     * First Chromium version with `documentId` in `webRequest` details.
     */
    private static readonly MIN_CHROMIUM_VERSION = 106;

    private static readonly CHROMIUM_VERSION_RE = /\bChrom(?:e|ium)\/(\d+)/;

    /**
     * Delivers canvas protection to the current document.
     */
    public static run(): void {
        CanvasProtectionDelivery.deliver(window);
    }

    /**
     * Requests the page script of the document and inserts it.
     *
     * @param realm Global object of the content script world.
     */
    public static deliver(realm: Window & typeof globalThis): void {
        try {
            const { protocol } = realm.location;
            if (protocol !== 'http:' && protocol !== 'https:') {
                return;
            }

            // Firefox registers the page script itself.
            if (browser.runtime.getURL('').startsWith('moz-extension:')) {
                return;
            }

            if (CanvasProtectionDelivery.isOldChromium(realm.navigator.userAgent)) {
                return;
            }

            const url = CanvasDeliveryUrl.getUrl(browser.runtime.id);
            const { document } = realm;
            const { featurePolicy } = document as Document & { featurePolicy?: FeaturePolicy };
            const xhr = new realm.XMLHttpRequest();

            // A page element with this `id` is a named property of `window`, so only `true` counts.
            // A synchronous request the policy forbids fails and reports a policy violation.
            if (Reflect.get(realm, CanvasDeliveryGuard.Delivered) === true
                || document instanceof realm.XMLDocument
                || featurePolicy?.allowsFeature('sync-xhr') !== true) {
                // Takes the single answer of the document, so that a page script cannot get it.
                xhr.open('GET', url, true);
                xhr.send();
                return;
            }

            xhr.open('GET', url, false);
            xhr.send();

            const text = xhr.responseText;
            if (!text) {
                return;
            }

            const parent = document.head || document.documentElement;
            if (!parent) {
                return;
            }

            const script = document.createElement('script');
            try {
                script.appendChild(document.createTextNode(text));
            } catch {
                script.setAttribute('type', 'text/javascript');
                script.textContent = text;
            }
            parent.appendChild(script);
            Reflect.set(realm, CanvasDeliveryGuard.Delivered, true);
            script.remove();
        } catch {
            // The request can be blocked; the background page then injects the code on commit.
        }
    }

    /**
     * Checks whether the browser is a Chromium version without `documentId` in `webRequest`.
     *
     * @param userAgent User agent of the browser.
     *
     * @returns True for Chromium before 106; false for later versions and unknown browsers.
     */
    private static isOldChromium(userAgent: string): boolean {
        const match = CanvasProtectionDelivery.CHROMIUM_VERSION_RE.exec(userAgent);
        return match !== null && Number(match[1]) < CanvasProtectionDelivery.MIN_CHROMIUM_VERSION;
    }
}
