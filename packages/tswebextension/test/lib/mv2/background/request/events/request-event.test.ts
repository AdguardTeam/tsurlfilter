import browser from 'sinon-chrome';
import { RequestEvent } from '@lib/mv2/background/request/events/request-event';

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

        const noop = jest.fn();

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

        const firstCallback = jest.fn();
        const secondCallback = jest.fn();

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

        const blockingCallback = jest.fn(() => ({ cancel: true }));
        const noop = jest.fn();

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
});
