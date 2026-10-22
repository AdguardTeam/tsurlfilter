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
            // A page element with this `id` is a named property of `window`, so only `true` counts.
            if (Reflect.get(realm, CanvasDeliveryGuard.Delivered) === true) {
                return;
            }

            const { protocol } = realm.location;
            if (protocol !== 'http:' && protocol !== 'https:') {
                return;
            }

            // Firefox registers the page script itself.
            if (browser.runtime.getURL('').startsWith('moz-extension:')) {
                return;
            }

            const { document } = realm;
            if (document instanceof realm.XMLDocument) {
                return;
            }

            // A synchronous request the policy forbids fails and reports a policy violation.
            const { featurePolicy } = document as Document & { featurePolicy?: FeaturePolicy };
            if (featurePolicy?.allowsFeature('sync-xhr') !== true) {
                return;
            }

            const xhr = new realm.XMLHttpRequest();
            xhr.open('GET', CanvasDeliveryUrl.URL, false);
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
