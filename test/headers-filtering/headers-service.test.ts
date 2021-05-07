import { WebRequest } from 'webextension-polyfill-ts';
import { HeadersService } from '../../src/headers-filtering/headers-service';
import { MockFilteringLog } from '../mock-filtering-log';
import { NetworkRule } from '../../src';
import OnBeforeSendHeadersDetailsType = WebRequest.OnBeforeSendHeadersDetailsType;
import OnHeadersReceivedDetailsType = WebRequest.OnHeadersReceivedDetailsType;

describe('Headers service', () => {
    const mockFilteringLog = new MockFilteringLog();
    const headersService = new HeadersService(mockFilteringLog);

    const details = {
        frameId: 0,
        method: 'GET',
        parentFrameId: 0,
        requestId: '1',
        tabId: 0,
        thirdParty: false,
        timeStamp: 0,
        type: 'main_frame',
        url: 'https://example.org',
    };

    beforeEach(() => {
        mockFilteringLog.addRemoveHeaderEvent.mockClear();
    });

    it('checks removing request headers', () => {
        headersService.onBeforeSendHeaders({
            ...details,
        } as OnBeforeSendHeadersDetailsType, []);
        expect(mockFilteringLog.addRemoveHeaderEvent).not.toHaveBeenCalled();

        const requestHeaders = [{
            name: 'test_name',
            value: 'test_value',
        }];

        headersService.onBeforeSendHeaders({
            requestHeaders,
            ...details,
        } as OnBeforeSendHeadersDetailsType, []);
        expect(mockFilteringLog.addRemoveHeaderEvent).not.toHaveBeenCalled();

        headersService.onBeforeSendHeaders({
            requestHeaders,
            ...details,
        } as OnBeforeSendHeadersDetailsType, [new NetworkRule('||example.org^$removeheader=an-other', 0)]);
        expect(mockFilteringLog.addRemoveHeaderEvent).not.toHaveBeenCalled();

        headersService.onBeforeSendHeaders({
            requestHeaders,
            ...details,
        } as OnBeforeSendHeadersDetailsType, [new NetworkRule('||example.org^$removeheader=test_name', 0)]);
        expect(mockFilteringLog.addRemoveHeaderEvent).not.toHaveBeenCalled();

        headersService.onBeforeSendHeaders({
            requestHeaders,
            ...details,
        } as OnBeforeSendHeadersDetailsType, [new NetworkRule('||example.org^$removeheader=request:test_name', 0)]);
        expect(mockFilteringLog.addRemoveHeaderEvent).toHaveBeenCalled();
    });

    it('checks removing response headers', () => {
        const result = headersService.onHeadersReceived({
            ...details,
        } as OnHeadersReceivedDetailsType, []);
        expect(result).toBeFalsy();
        expect(mockFilteringLog.addRemoveHeaderEvent).not.toHaveBeenCalled();

        const responseHeaders = [{
            name: 'test_name',
            value: 'test_value',
        }];

        headersService.onHeadersReceived({
            responseHeaders,
            ...details,
        } as OnHeadersReceivedDetailsType, []);
        expect(mockFilteringLog.addRemoveHeaderEvent).not.toHaveBeenCalled();

        headersService.onHeadersReceived({
            responseHeaders,
            ...details,
        } as OnHeadersReceivedDetailsType, [new NetworkRule('||example.org^$removeheader=an-other', 0)]);
        expect(mockFilteringLog.addRemoveHeaderEvent).not.toHaveBeenCalled();

        headersService.onHeadersReceived({
            responseHeaders,
            ...details,
        } as OnHeadersReceivedDetailsType, [new NetworkRule('||example.org^$removeheader=request:test_name', 0)]);
        expect(mockFilteringLog.addRemoveHeaderEvent).not.toHaveBeenCalled();

        headersService.onHeadersReceived({
            responseHeaders,
            ...details,
        } as OnHeadersReceivedDetailsType, [new NetworkRule('||example.org^$removeheader=test_name', 0)]);
        expect(mockFilteringLog.addRemoveHeaderEvent).toHaveBeenCalled();
    });
});
