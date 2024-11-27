import browser from 'sinon-chrome';
import { type WebRequest } from 'webextension-polyfill';
import { HTTPMethod } from '@adguard/tsurlfilter';
import {
    RequestEvents,
    DocumentLifecycle,
    type OnBeforeRequestDetailsType,
} from '../../../../../../src/lib/mv3/background/request/events/request-events';

describe('Request Events', () => {
    const commonRequestData: OnBeforeRequestDetailsType = {
        requestId: '12345',
        frameId: 0,
        method: HTTPMethod.GET,
        parentFrameId: -1,
        tabId: 1,
        type: 'main_frame' as WebRequest.ResourceType,
        url: 'https://example.com/',
        originUrl: 'https://testcases.adguard.com',
        thirdParty: false,
        timeStamp: 0,
    };

    it('onBeforeRequest with prerender request', async () => {
        RequestEvents.init();

        const listener = jest.fn();

        RequestEvents.onBeforeRequest.addListener(listener);

        const timestamp = Date.now();

        const prerenderRequestDetails: OnBeforeRequestDetailsType = {
            ...commonRequestData,
            // Tab id will be not the same with the current opened tab.
            tabId: 2,
            thirdParty: false,
            documentLifecycle: DocumentLifecycle.prerender,
            timeStamp: timestamp,
        };

        jest.spyOn(Date, 'now').mockReturnValueOnce(timestamp);

        browser.webRequest.onBeforeRequest.dispatch(prerenderRequestDetails);

        // Then simulate request with navigation change.
        const requestDetails: OnBeforeRequestDetailsType = {
            ...commonRequestData,
            timeStamp: timestamp,
            documentLifecycle: DocumentLifecycle.active,
        };

        browser.webRequest.onBeforeRequest.dispatch(requestDetails);

        // First prerender request
        expect(listener).toHaveBeenNthCalledWith(1, expect.objectContaining({
            details: expect.objectContaining({
                tabId: 2,
                url: 'https://example.com/',
                // Prepender request isn't third party
                thirdParty: false,
            }),
            context: expect.objectContaining({
                tabId: 2,
                requestUrl: 'https://example.com/',
                thirdParty: false,
            }),
        }));

        // Second is real navigation request
        expect(listener).toHaveBeenNthCalledWith(2, expect.objectContaining({
            details: expect.objectContaining({
                // Get frame url if is active request
                originUrl: 'https://testcases.adguard.com',
                url: 'https://example.com/',
                tabId: 1,
            }),
            context: expect.objectContaining({
                requestUrl: 'https://example.com/',
                referrerUrl: 'https://testcases.adguard.com',
                // Real navigation request is third party
                thirdParty: true,
            }),
        }));
    });
});
