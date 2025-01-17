import browser from 'sinon-chrome';
import {
    describe,
    it,
    expect,
    vi,
} from 'vitest';
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

        const listener = vi.fn();

        RequestEvents.onBeforeRequest.addListener(listener);

        const timestamp = Date.now();

        const prerenderRequestDetails: OnBeforeRequestDetailsType = {
            ...commonRequestData,
            originUrl: undefined,
            // Tab id will be not the same with the current opened tab.
            tabId: 2,
            documentLifecycle: DocumentLifecycle.Prerender,
            timeStamp: timestamp,
        };

        vi.spyOn(Date, 'now').mockReturnValueOnce(timestamp);

        browser.webRequest.onBeforeRequest.dispatch(prerenderRequestDetails);

        // Then simulate request with navigation change.
        const requestDetails: OnBeforeRequestDetailsType = {
            ...commonRequestData,
            timeStamp: timestamp,
            documentLifecycle: DocumentLifecycle.Active,
        };

        browser.webRequest.onBeforeRequest.dispatch(requestDetails);

        /**
         * Verify prerender request handling.
         */
        expect(listener).toHaveBeenNthCalledWith(1, expect.objectContaining({
            details: expect.objectContaining({
                tabId: 2,
                url: 'https://example.com/',
                documentLifecycle: 'prerender',
            }),
            context: expect.objectContaining({
                tabId: 2,
                requestUrl: 'https://example.com/',
                referrerUrl: 'https://example.com/',
                thirdParty: false,
            }),
        }));

        /**
         * Verify active navigation request handling:
         * 1. Uses actual navigation tabId
         * 2. Includes origin/referrer information
         * 3. Correctly identifies third-party status based on domains
         *    (example.com vs testcases.adguard.com).
         */
        expect(listener).toHaveBeenNthCalledWith(2, expect.objectContaining({
            details: expect.objectContaining({
                originUrl: 'https://testcases.adguard.com',
                url: 'https://example.com/',
                tabId: 1,
            }),
            context: expect.objectContaining({
                requestUrl: 'https://example.com/',
                referrerUrl: 'https://testcases.adguard.com',
                thirdParty: true,
            }),
        }));
    });
});
