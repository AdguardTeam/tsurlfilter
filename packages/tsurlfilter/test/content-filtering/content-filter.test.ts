import { TextEncoder, TextDecoder } from 'text-encoding';
import { ContentFilter } from '../../src/content-filtering/content-filter';
import { NetworkRule, RequestType } from '../../src';
import { DEFAULT_CHARSET, WIN_1251, WIN_1252 } from '../../src/content-filtering/charsets';
import { MockStreamFilter } from './mock-stream-filter';

describe('Content filter', () => {
    const textEncoderUtf8 = new TextEncoder();
    const textDecoderUtf8 = new TextDecoder();

    const textEncoderWin1251 = new TextEncoder(WIN_1251, { NONSTANDARD_allowLegacyEncoding: true });
    const textDecoderWin1251 = new TextDecoder(WIN_1251);

    const textEncoderIso8859 = new TextEncoder(WIN_1252, { NONSTANDARD_allowLegacyEncoding: true });
    const textDecoderIso8859 = new TextDecoder(WIN_1252);

    const onContentCallback = jest.fn((data: string | null) => {
        expect(data).not.toBeNull();
    });

    beforeEach(() => {
        onContentCallback.mockReset();
    });

    const testData = 'some data';

    const requestContext = {
        requestId: '1',
        requestUrl: 'https://example.org',
        engineRequestType: RequestType.Document,
        contentType: 'text/html',
        statusCode: 200,
        method: 'GET',
        tab: {
            tabId: 1,
        },
    };

    it('checks content filter with utf-8 encoding', () => {
        const mockFilter = new MockStreamFilter();
        const filter = new ContentFilter(mockFilter, requestContext, [], [
            new NetworkRule('replace-rule', 1),
        ], onContentCallback);
        filter.setCharset(DEFAULT_CHARSET);

        mockFilter.send(textEncoderUtf8.encode(testData));
        expect(onContentCallback).toHaveBeenCalled();
        expect(onContentCallback).toHaveBeenLastCalledWith(testData, requestContext);

        filter.write(testData);

        const received = textDecoderUtf8.decode(mockFilter.receive());

        expect(received).not.toBeNull();
        expect(received).toBe(testData);
    });

    it('checks content filter with win-1251 encoding', () => {
        const mockFilter = new MockStreamFilter();
        const filter = new ContentFilter(mockFilter, requestContext, [], [
            new NetworkRule('replace-rule', 1),
        ], onContentCallback);
        filter.setCharset(WIN_1251);

        mockFilter.send(textEncoderWin1251.encode(testData));
        expect(onContentCallback).toHaveBeenCalled();
        expect(onContentCallback).toHaveBeenLastCalledWith(testData, requestContext);

        filter.write(testData);

        const received = textDecoderWin1251.decode(mockFilter.receive());

        expect(received).not.toBeNull();
        expect(received).toBe(testData);
    });

    it('checks content filter with win-1252 encoding', () => {
        const mockFilter = new MockStreamFilter();
        const filter = new ContentFilter(mockFilter, requestContext, [], [
            new NetworkRule('replace-rule', 1),
        ], onContentCallback);
        filter.setCharset(WIN_1252);

        mockFilter.send(textEncoderIso8859.encode(testData));
        expect(onContentCallback).toHaveBeenCalled();
        expect(onContentCallback).toHaveBeenLastCalledWith(testData, requestContext);

        filter.write(testData);

        const received = textDecoderIso8859.decode(mockFilter.receive());

        expect(received).not.toBeNull();
        expect(received).toBe(testData);
    });

    it('checks parsing charset from data - utf-8', () => {
        const data = 'Тест charset in data <meta charset="UTF-8">';

        const mockFilter = new MockStreamFilter();
        const filter = new ContentFilter(mockFilter, requestContext, [], [
            new NetworkRule('replace-rule', 1),
        ], onContentCallback);

        mockFilter.send(textEncoderUtf8.encode(data));
        expect(onContentCallback).toHaveBeenCalled();
        expect(onContentCallback).toHaveBeenLastCalledWith(data, requestContext);

        filter.write(data);

        const received = textDecoderUtf8.decode(mockFilter.receive());

        expect(received).not.toBeNull();
        expect(received).toBe(data);
    });

    it('checks parsing charset from data - utf-8 - http-equiv', () => {
        const data = 'Тест charset in data <meta content="text/html; charset=utf-8" http-equiv="content-type"/>';

        const mockFilter = new MockStreamFilter();
        const filter = new ContentFilter(mockFilter, requestContext, [], [
            new NetworkRule('replace-rule', 1),
        ], onContentCallback);

        mockFilter.send(textEncoderUtf8.encode(data));
        expect(onContentCallback).toHaveBeenCalled();
        expect(onContentCallback).toHaveBeenLastCalledWith(data, requestContext);

        filter.write(data);

        const received = textDecoderUtf8.decode(mockFilter.receive());

        expect(received).not.toBeNull();
        expect(received).toBe(data);
    });

    it('checks parsing charset from data - win-1251', () => {
        const data = 'Тест charset in data <meta charset="windows-1251">';

        const mockFilter = new MockStreamFilter();
        const filter = new ContentFilter(mockFilter, requestContext, [], [
            new NetworkRule('replace-rule', 1),
        ], onContentCallback);

        mockFilter.send(textEncoderWin1251.encode(data));
        expect(onContentCallback).toHaveBeenCalled();
        expect(onContentCallback).toHaveBeenLastCalledWith(data, requestContext);

        filter.write(data);

        const received = textDecoderWin1251.decode(mockFilter.receive());

        expect(received).not.toBeNull();
        expect(received).toBe(data);
    });

    it('checks parsing charset from data - iso-8859-1', () => {
        const data = 'Charset in data <meta charset="iso-8859-1">';

        const mockFilter = new MockStreamFilter();
        const filter = new ContentFilter(mockFilter, requestContext, [], [
            new NetworkRule('replace-rule', 1),
        ], onContentCallback);

        mockFilter.send(textEncoderIso8859.encode(data));
        expect(onContentCallback).toHaveBeenCalled();
        expect(onContentCallback).toHaveBeenLastCalledWith(data, requestContext);

        filter.write(data);

        const received = textDecoderIso8859.decode(mockFilter.receive());

        expect(received).not.toBeNull();
        expect(received).toBe(data);
    });

    it('checks parsing charset from data - win-1251', () => {
        const data = 'Тест charset in data <meta http-equiv="content-type" content="text/html; charset=windows-1251">';

        const mockFilter = new MockStreamFilter();
        const filter = new ContentFilter(mockFilter, requestContext, [], [
            new NetworkRule('replace-rule', 1),
        ], onContentCallback);

        mockFilter.send(textEncoderWin1251.encode(data));
        expect(onContentCallback).toHaveBeenCalled();
        expect(onContentCallback).toHaveBeenLastCalledWith(data, requestContext);

        filter.write(data);

        const received = textDecoderWin1251.decode(mockFilter.receive());

        expect(received).not.toBeNull();
        expect(received).toBe(data);
    });

    it('checks parsing charset from data - no charset in data', () => {
        const data = 'No charset in data';

        const mockFilter = new MockStreamFilter();
        const filter = new ContentFilter(mockFilter, requestContext, [], [
            new NetworkRule('replace-rule', 1),
        ], onContentCallback);

        mockFilter.send(textEncoderIso8859.encode(data));
        expect(onContentCallback).toHaveBeenCalled();
        expect(onContentCallback).toHaveBeenLastCalledWith(data, requestContext);

        filter.write(data);

        const received = textDecoderIso8859.decode(mockFilter.receive());

        expect(received).not.toBeNull();
        expect(received).toBe(data);
    });

    it('checks parsing charset from data - unsupported charset in data', () => {
        const onNullContentCallback = jest.fn((data: string | null) => {
            expect(data).toBeFalsy();
        });

        const data = 'unsupported charset in data <meta charset="koi8-r">';

        const mockFilter = new MockStreamFilter();
        const filter = new ContentFilter(mockFilter, requestContext, [], [
            new NetworkRule('replace-rule', 1),
        ], onNullContentCallback);

        mockFilter.send(textEncoderUtf8.encode(data));
        expect(onNullContentCallback).toHaveBeenCalled();
        expect(onNullContentCallback).toHaveBeenLastCalledWith('', requestContext);

        filter.write(data);

        const received = textDecoderUtf8.decode(mockFilter.receive());
        expect(received).toBe(data);
    });

    it('checks content filter with empty content', () => {
        const mockFilter = new MockStreamFilter();
        const filter = new ContentFilter(mockFilter, requestContext, [], [
            new NetworkRule('replace-rule', 1),
        ], onContentCallback);
        filter.setCharset(DEFAULT_CHARSET);

        mockFilter.send(textEncoderUtf8.encode(''));
        filter.write(testData);

        const received = textDecoderUtf8.decode(mockFilter.receive());

        expect(received).not.toBeNull();
        expect(received).toBe(testData);
    });

    it('checks content filter with unsupported content-type header', () => {
        const context = {
            ...requestContext,
            contentType: 'application/octet-stream',
            engineRequestType: RequestType.Other,
        };
        const mockFilter = new MockStreamFilter();

        const spyDisconnect = jest.spyOn(mockFilter, 'disconnect');

        const filter = new ContentFilter(mockFilter, context, [], [], onContentCallback);

        filter.setCharset(DEFAULT_CHARSET);

        mockFilter.send(textEncoderUtf8.encode(testData));

        expect(spyDisconnect).toHaveBeenCalledTimes(1);

    });
});
