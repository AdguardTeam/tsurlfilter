import browser from 'sinon-chrome';
import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { RequestEvent } from '../../../../../../src/lib';
import { CanvasDeliveryUrl } from '../../../../../../src/lib/mv2/common/canvas-delivery';

describe('Request Event', () => {
    it('subscribes to original event once on initialization', () => {
        const event = new RequestEvent();

        event.init(
            browser.webRequest.onBeforeRequest,
            (details) => ({ details }),
            { urls: ['<all_urls>'] },
            ['blocking', 'requestBody'],
        );

        expect(browser.webRequest.onBeforeRequest.addListener.calledOnce);

        const noop = vi.fn();

        event.addListener(noop);

        expect(browser.webRequest.onBeforeRequest.addListener.calledOnce);
    });

    it('can add and remove listeners', () => {
        const event = new RequestEvent();

        event.init(
            browser.webRequest.onBeforeRequest,
            (details) => ({ details }),
            { urls: ['<all_urls>'] },
            ['blocking', 'requestBody'],
        );

        const firstCallback = vi.fn();
        const secondCallback = vi.fn();

        event.addListener(firstCallback);
        event.addListener(secondCallback);

        expect(event.listeners.length).toBe(2);

        event.removeListener(firstCallback);

        expect(event.listeners.length).toBe(1);
        expect(event.listeners[0]).toBe(secondCallback);
    });

    it('doesn`t call rest listeners after non-empty value returns', () => {
        const event = new RequestEvent();

        event.init(
            browser.webRequest.onBeforeRequest,
            (details) => ({ details }),
            { urls: ['<all_urls>'] },
            ['blocking', 'requestBody'],
        );

        const blockingCallback = vi.fn(() => ({ cancel: true }));
        const noop = vi.fn();

        event.addListener(blockingCallback);
        event.addListener(noop);

        browser.webRequest.onBeforeRequest.dispatch({
            frameId: 0,
            initiator: 'https://testcases.adguard.com',
            method: 'GET',
            parentFrameId: -1,
            requestId: '2869',
            tabId: 130,
            timeStamp: 1638871587708.284,
            type: 'stylesheet',
            url: 'https://testcases.adguard.com/static/css/main.972e6dfc.chunk.css',
            thirdParty: false,
        });

        expect(blockingCallback).toBeCalledTimes(1);
        expect(noop).toBeCalledTimes(0);
    });

    it('skips requests to the reserved canvas delivery host', () => {
        const event = new RequestEvent();
        const handler = vi.fn((details: { url: string }) => ({ details }));

        event.init(
            browser.webRequest.onBeforeRequest,
            handler,
            { urls: ['<all_urls>'] },
            ['blocking', 'requestBody'],
        );

        const response = { cancel: true };
        const listener = vi.fn(() => response);

        event.addListener(listener);

        const browserListener = browser.webRequest.onBeforeRequest.addListener.lastCall.args[0];

        expect(browserListener({ url: CanvasDeliveryUrl.getUrl('extensionid') })).toBeUndefined();
        expect(handler).not.toHaveBeenCalled();
        expect(listener).not.toHaveBeenCalled();

        expect(browserListener({ url: 'https://example.org/' })).toBe(response);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledTimes(1);
    });
});
