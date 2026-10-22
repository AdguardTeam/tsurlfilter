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
 * The background page answers only the first request of a document, so the content script
 * always sends one before page scripts run, asynchronously when it does not need the script:
 * a page script repeating the request then fails as it would without the extension.
 *
 * TODO: remove when Chromium MV2 is no longer supported.
 */
export class CanvasProtectionDelivery {
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
}
