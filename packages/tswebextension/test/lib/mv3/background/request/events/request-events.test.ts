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
    type OnBeforeRequestDetailsType,
} from '../../../../../../src/lib/mv3/background/request/events/request-events';
import { DocumentLifecycle } from '../../../../../../src/lib/common/interfaces';
import { defaultFilteringLog, FilteringEventType } from '../../../../../../src/lib/common/filtering-log';

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

    describe('TabReload filtering log event', () => {
        it('should NOT publish TabReload for prerender document requests', () => {
            const filteringLogSpy = vi.spyOn(defaultFilteringLog, 'publishEvent');

            const prerenderRequestDetails: OnBeforeRequestDetailsType = {
                ...commonRequestData,
                requestId: 'prerender-tab-reload-1',
                originUrl: undefined,
                tabId: 2,
                documentLifecycle: DocumentLifecycle.Prerender,
                timeStamp: Date.now(),
            };

            browser.webRequest.onBeforeRequest.dispatch(prerenderRequestDetails);

            // Verify TabReload was NOT published for prerender request
            const tabReloadCalls = filteringLogSpy.mock.calls.filter(
                (call: unknown[]) => (call[0] as { type?: string })?.type === FilteringEventType.TabReload,
            );
            expect(tabReloadCalls).toHaveLength(0);

            filteringLogSpy.mockRestore();
        });

        it('should publish TabReload for active document requests', () => {
            const filteringLogSpy = vi.spyOn(defaultFilteringLog, 'publishEvent');

            const activeRequestDetails: OnBeforeRequestDetailsType = {
                ...commonRequestData,
                requestId: 'active-tab-reload-1',
                documentLifecycle: DocumentLifecycle.Active,
                timeStamp: Date.now(),
            };

            browser.webRequest.onBeforeRequest.dispatch(activeRequestDetails);

            // Verify TabReload WAS published for active request
            const tabReloadCalls = filteringLogSpy.mock.calls.filter(
                (call: unknown[]) => (call[0] as { type?: string })?.type === FilteringEventType.TabReload,
            );
            expect(tabReloadCalls.length).toBeGreaterThanOrEqual(1);

            filteringLogSpy.mockRestore();
        });

        it('should publish TabReload for document requests without documentLifecycle (older browsers)', () => {
            const filteringLogSpy = vi.spyOn(defaultFilteringLog, 'publishEvent');

            const requestDetails: OnBeforeRequestDetailsType = {
                ...commonRequestData,
                requestId: 'no-lifecycle-tab-reload-1',
                // documentLifecycle is undefined (older browser)
                timeStamp: Date.now(),
            };

            browser.webRequest.onBeforeRequest.dispatch(requestDetails);

            // Verify TabReload WAS published (backward compatibility)
            const tabReloadCalls = filteringLogSpy.mock.calls.filter(
                (call: unknown[]) => (call[0] as { type?: string })?.type === FilteringEventType.TabReload,
            );
            expect(tabReloadCalls.length).toBeGreaterThanOrEqual(1);

            filteringLogSpy.mockRestore();
        });
    });
});
