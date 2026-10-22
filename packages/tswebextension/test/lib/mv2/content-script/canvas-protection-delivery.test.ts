import browser from 'sinon-chrome';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import polyfill from 'webextension-polyfill';

import { CanvasDeliveryGuard, CanvasDeliveryUrl } from '../../../../src/lib/mv2/common/canvas-delivery';
import { CanvasProtectionDelivery } from '../../../../src/lib/mv2/content-script/canvas-protection-delivery';

const BODY = 'document.documentElement.setAttribute("data-delivered-body-ran", "");';
const MARKER = 'data-delivered-body-ran';
const EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';
const URL = CanvasDeliveryUrl.getUrl(EXTENSION_ID);

/**
 * Options of a fake content script realm.
 */
interface RealmOptions {
    protocol?: string;
    doc?: Document;
    responseText?: string;
    sendThrows?: boolean;
    flag?: unknown;
}

/**
 * Sets the feature policy stub of a document.
 *
 * @param doc Document.
 * @param syncXhr Whether `sync-xhr` is allowed, or `undefined` for no feature policy.
 */
const setFeaturePolicy = (doc: Document, syncXhr: boolean | undefined): void => {
    Object.defineProperty(doc, 'featurePolicy', {
        configurable: true,
        value: syncXhr === undefined ? undefined : {
            allowsFeature: (feature: string): boolean => feature === 'sync-xhr' && syncXhr,
        },
    });
};

describe('CanvasProtectionDelivery', () => {
    let requests: unknown[][];
    let sends: number;

    /**
     * Creates a fake content script realm.
     *
     * @param options Realm options.
     *
     * @returns The realm.
     */
    const createRealm = (options: RealmOptions = {}): Window & typeof globalThis => {
        const {
            protocol = 'https:',
            doc = document,
            responseText = BODY,
            sendThrows = false,
            flag,
        } = options;

        /**
         * Fake synchronous request.
         */
        class FakeXhr {
            public responseText = '';

            /**
             * Records the request.
             *
             * @param args Arguments of `open`.
             */
            // eslint-disable-next-line class-methods-use-this
            public open(...args: unknown[]): void {
                requests.push(args);
            }

            /**
             * Sends the request.
             *
             * @throws When the request fails.
             */
            public send(): void {
                sends += 1;
                if (sendThrows) {
                    throw new Error('NetworkError');
                }
                this.responseText = responseText;
            }
        }

        const realm = {
            location: { protocol },
            document: doc,
            XMLDocument: window.XMLDocument,
            XMLHttpRequest: FakeXhr,
        };
        if (flag !== undefined) {
            Reflect.set(realm, CanvasDeliveryGuard.Delivered, flag);
        }
        return realm as unknown as Window & typeof globalThis;
    };

    beforeEach(() => {
        Object.defineProperty(polyfill.runtime, 'id', { configurable: true, value: EXTENSION_ID });
        requests = [];
        sends = 0;
        browser.runtime.getURL.returns('chrome-extension://id/');
        setFeaturePolicy(document, true);
    });

    afterEach(() => {
        document.documentElement.removeAttribute(MARKER);
        Reflect.deleteProperty(document, 'featurePolicy');
        vi.restoreAllMocks();
    });

    it('sends one synchronous GET to the reserved URL in a Chromium web document', () => {
        CanvasProtectionDelivery.deliver(createRealm({ responseText: '' }));
        expect(requests).toEqual([['GET', URL, false]]);
        expect(sends).toBe(1);
    });

    it('sends nothing in Firefox', () => {
        browser.runtime.getURL.returns('moz-extension://id/');
        CanvasProtectionDelivery.deliver(createRealm());
        expect(sends).toBe(0);
    });

    it('only uses up the answer with an asynchronous request when the document already got canvas protection', () => {
        CanvasProtectionDelivery.deliver(createRealm({ flag: true }));
        expect(requests).toEqual([['GET', URL, true]]);
        expect(sends).toBe(1);
        expect(document.documentElement.hasAttribute(MARKER)).toBe(false);
    });

    it('sends a request when only a page element carries the flag\'s id', () => {
        CanvasProtectionDelivery.deliver(createRealm({ flag: document.createElement('div'), responseText: '' }));
        expect(requests).toEqual([['GET', URL, false]]);
    });

    it.each(['about:', 'blob:', 'data:'])('sends nothing in documents that are not web pages: %s', (protocol) => {
        CanvasProtectionDelivery.deliver(createRealm({ protocol }));
        expect(sends).toBe(0);
    });

    it('only uses up the answer with an asynchronous request when the feature policy forbids sync-xhr', () => {
        setFeaturePolicy(document, false);
        CanvasProtectionDelivery.deliver(createRealm());
        setFeaturePolicy(document, undefined);
        CanvasProtectionDelivery.deliver(createRealm());
        expect(requests).toEqual([['GET', URL, true], ['GET', URL, true]]);
        expect(document.documentElement.hasAttribute(MARKER)).toBe(false);
    });

    it('only uses up the answer with an asynchronous request in an XML document', () => {
        const doc = document.implementation.createDocument(null, 'root');
        setFeaturePolicy(doc, true);
        CanvasProtectionDelivery.deliver(createRealm({ doc }));
        expect(requests).toEqual([['GET', URL, true]]);
    });

    it('inserts a non-empty body as an inline script and removes it', () => {
        const appendChild = vi.spyOn(document.head, 'appendChild');
        const realm = createRealm();
        CanvasProtectionDelivery.deliver(realm);
        expect(document.documentElement.hasAttribute(MARKER)).toBe(true);
        expect(appendChild).toHaveBeenCalledTimes(1);
        const script = appendChild.mock.calls[0][0] as HTMLScriptElement;
        expect(script.tagName).toBe('SCRIPT');
        expect(script.text).toBe(BODY);
        expect(document.querySelector('script')).toBeNull();
        expect(Reflect.get(realm, CanvasDeliveryGuard.Delivered)).toBe(true);
    });

    it('falls back to textContent when a text node cannot be appended', () => {
        vi.spyOn(document, 'createTextNode').mockReturnValue({} as Text);
        const realm = createRealm();
        CanvasProtectionDelivery.deliver(realm);
        expect(document.documentElement.hasAttribute(MARKER)).toBe(true);
        expect(document.querySelector('script')).toBeNull();
        expect(Reflect.get(realm, CanvasDeliveryGuard.Delivered)).toBe(true);
    });

    it('inserts nothing for an empty body', () => {
        const appendChild = vi.spyOn(document.head, 'appendChild');
        const realm = createRealm({ responseText: '' });
        CanvasProtectionDelivery.deliver(realm);
        expect(appendChild).not.toHaveBeenCalled();
        expect(Reflect.get(realm, CanvasDeliveryGuard.Delivered)).toBeUndefined();
    });

    it('leaves the flag unset without a parent element', () => {
        const doc = {
            head: null,
            documentElement: null,
            featurePolicy: { allowsFeature: () => true },
            createElement: document.createElement.bind(document),
            createTextNode: document.createTextNode.bind(document),
        } as unknown as Document;
        const realm = createRealm({ doc });
        CanvasProtectionDelivery.deliver(realm);
        expect(sends).toBe(1);
        expect(Reflect.get(realm, CanvasDeliveryGuard.Delivered)).toBeUndefined();
    });

    it('leaves the flag unset when no script is requested', () => {
        browser.runtime.getURL.returns('moz-extension://id/');
        const firefox = createRealm();
        CanvasProtectionDelivery.deliver(firefox);
        browser.runtime.getURL.returns('chrome-extension://id/');

        const notWeb = createRealm({ protocol: 'about:' });
        CanvasProtectionDelivery.deliver(notWeb);

        setFeaturePolicy(document, false);
        const forbidden = createRealm();
        CanvasProtectionDelivery.deliver(forbidden);

        [firefox, notWeb, forbidden].forEach((realm) => {
            expect(Reflect.get(realm, CanvasDeliveryGuard.Delivered)).toBeUndefined();
        });
    });

    it('swallows request errors', () => {
        const realm = createRealm({ sendThrows: true });
        expect(() => CanvasProtectionDelivery.deliver(realm)).not.toThrow();
        expect(sends).toBe(1);
        expect(Reflect.get(realm, CanvasDeliveryGuard.Delivered)).toBeUndefined();
    });
});
