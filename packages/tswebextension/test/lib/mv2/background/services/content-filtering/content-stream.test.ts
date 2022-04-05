import { TextEncoder, TextDecoder } from 'text-encoding';
import { RequestType } from '@adguard/tsurlfilter';
import { ContentStream } from '@lib/mv2/background/services/content-filtering/content-stream';
import { DEFAULT_CHARSET, WIN_1251, WIN_1252 } from '@lib/mv2/background/services/content-filtering/charsets';
import { RequestContext, RequestContextState } from '@lib/mv2/background/request';
import { ContentStringFilterInterface } from '@lib/mv2/background/services/content-filtering/content-string-filter';
import { MockStreamFilter } from './mock-stream-filter';
import { MockFilteringLog } from '../../../../common/mock-filtering-log';

describe('Content stream', () => {
    const textEncoderUtf8 = new TextEncoder();
    const textDecoderUtf8 = new TextDecoder();

    const textEncoderWin1251 = new TextEncoder(WIN_1251, { NONSTANDARD_allowLegacyEncoding: true });
    const textDecoderWin1251 = new TextDecoder(WIN_1251);

    const textEncoderIso8859 = new TextEncoder(WIN_1252, { NONSTANDARD_allowLegacyEncoding: true });
    const textDecoderIso8859 = new TextDecoder(WIN_1252);

    const testData = 'some data';

    const contentStringFilter: ContentStringFilterInterface = {
        applyRules: (content: string) => content,
    };

    const context = {
        state: RequestContextState.HEADERS_RECEIVED,
        requestId: '1',
        requestUrl: 'https://example.org',
        referrerUrl: 'https://example.org',
        tabId: 0,
        frameId: 0,
        timestamp: 1643639355148,
        requestType: RequestType.Document,
        method: 'GET',
        statusCode: 200,
    } as RequestContext;

    it('checks content stream with utf-8 encoding', () => {
        const mockFilter = new MockStreamFilter();
        const stream = new ContentStream(
            context,
            contentStringFilter,
            () => mockFilter,
            new MockFilteringLog(),
        );

        stream.init();

        stream.setCharset(DEFAULT_CHARSET);

        mockFilter.send(textEncoderUtf8.encode(testData));

        stream.write(testData);

        const received = textDecoderUtf8.decode(mockFilter.receive());

        expect(received).toBe(testData);
    });

    it('checks content stream with win-1251 encoding', () => {
        const mockFilter = new MockStreamFilter();
        const stream = new ContentStream(
            context,
            contentStringFilter,
            () => mockFilter,
            new MockFilteringLog(),
        );

        stream.init();

        stream.setCharset(WIN_1251);

        mockFilter.send(textEncoderWin1251.encode(testData));

        stream.write(testData);

        const received = textDecoderWin1251.decode(mockFilter.receive());

        expect(received).toBe(testData);
    });

    it('checks content stream with win-1252 encoding', () => {
        const mockFilter = new MockStreamFilter();
        const stream = new ContentStream(
            context,
            contentStringFilter,
            () => mockFilter,
            new MockFilteringLog(),
        );

        stream.init();

        stream.setCharset(WIN_1252);

        mockFilter.send(textEncoderIso8859.encode(testData));

        stream.write(testData);

        const received = textDecoderIso8859.decode(mockFilter.receive());

        expect(received).not.toBeNull();
        expect(received).toBe(testData);
    });

    it('checks parsing charset from data - utf-8', () => {
        const data = 'Тест charset in data <meta charset="UTF-8">';

        const mockFilter = new MockStreamFilter();
        const stream = new ContentStream(
            context,
            contentStringFilter,
            () => mockFilter,
            new MockFilteringLog(),
        );

        stream.init();

        mockFilter.send(textEncoderUtf8.encode(data));

        stream.write(data);

        const received = textDecoderUtf8.decode(mockFilter.receive());

        expect(received).toBe(data);
    });

    it('checks parsing charset from data - utf-8 - http-equiv', () => {
        const data = 'Тест charset in data <meta content="text/html; charset=utf-8" http-equiv="content-type"/>';

        const mockFilter = new MockStreamFilter();
        const stream = new ContentStream(
            context,
            contentStringFilter,
            () => mockFilter,
            new MockFilteringLog(),
        );

        stream.init();

        mockFilter.send(textEncoderUtf8.encode(data));

        stream.write(data);

        const received = textDecoderUtf8.decode(mockFilter.receive());

        expect(received).toBe(data);
    });

    it('checks parsing charset from data - win-1251', () => {
        const data = 'Тест charset in data <meta charset="windows-1251">';

        const mockFilter = new MockStreamFilter();
        const stream = new ContentStream(
            context,
            contentStringFilter,
            () => mockFilter,
            new MockFilteringLog(),
        );

        stream.init();

        mockFilter.send(textEncoderWin1251.encode(data));

        stream.write(data);

        const received = textDecoderWin1251.decode(mockFilter.receive());

        expect(received).toBe(data);
    });

    it('checks parsing charset from data - iso-8859-1', () => {
        const data = 'Charset in data <meta charset="iso-8859-1">';

        const mockFilter = new MockStreamFilter();
        const stream = new ContentStream(
            context,
            contentStringFilter,
            () => mockFilter,
            new MockFilteringLog(),
        );

        stream.init();

        mockFilter.send(textEncoderIso8859.encode(data));

        stream.write(data);

        const received = textDecoderIso8859.decode(mockFilter.receive());

        expect(received).toBe(data);
    });

    it('checks parsing charset from data - win-1251', () => {
        const data = 'Тест charset in data <meta http-equiv="content-type" content="text/html; charset=windows-1251">';

        const mockFilter = new MockStreamFilter();
        const stream = new ContentStream(
            context,
            contentStringFilter,
            () => mockFilter,
            new MockFilteringLog(),
        );

        stream.init();

        mockFilter.send(textEncoderWin1251.encode(data));

        stream.write(data);

        const received = textDecoderWin1251.decode(mockFilter.receive());

        expect(received).toBe(data);
    });

    it('checks parsing charset from data - no charset in data', () => {
        const data = 'No charset in data';

        const mockFilter = new MockStreamFilter();
        const stream = new ContentStream(
            context,
            contentStringFilter,
            () => mockFilter,
            new MockFilteringLog(),
        );

        stream.init();

        mockFilter.send(textEncoderIso8859.encode(data));

        stream.write(data);

        const received = textDecoderIso8859.decode(mockFilter.receive());

        expect(received).toBe(data);
    });

    it('checks parsing charset from data - unsupported charset in data', () => {
        const data = 'unsupported charset in data <meta charset="koi8-r">';

        const mockFilter = new MockStreamFilter();
        const stream = new ContentStream(
            context,
            contentStringFilter,
            () => mockFilter,
            new MockFilteringLog(),
        );

        stream.init();

        mockFilter.send(textEncoderUtf8.encode(data));

        stream.write(data);

        const received = textDecoderUtf8.decode(mockFilter.receive());

        expect(received).toBe(data);
    });

    it('checks content stream with empty content', () => {
        const mockFilter = new MockStreamFilter();

        const stream = new ContentStream(
            context,
            contentStringFilter,
            () => mockFilter,
            new MockFilteringLog(),
        );

        stream.init();

        stream.setCharset(DEFAULT_CHARSET);

        mockFilter.send(textEncoderUtf8.encode(''));
        stream.write(testData);

        const received = textDecoderUtf8.decode(mockFilter.receive());

        expect(received).toBe(testData);
    });

    it('checks content stream with unsupported content type', () => {
        const mockFilter = new MockStreamFilter();

        const unsupportedRequestContext = {
            ...context,
            requestType: RequestType.XmlHttpRequest,
            contentTypeHeader: 'multipart/form-data; boundary=something',
        } as RequestContext;

        const stream = new ContentStream(
            unsupportedRequestContext,
            contentStringFilter,
            () => mockFilter,
            new MockFilteringLog(),
        );

        stream.init();

        stream.setCharset(DEFAULT_CHARSET);

        const spyDisconnect = jest.spyOn(mockFilter, 'disconnect').mockImplementation();
        const spyWrite = jest.spyOn(mockFilter, 'write').mockImplementation();

        const data = textEncoderUtf8.encode('qwerty');
        mockFilter.send(data);

        expect(spyWrite).toBeCalledWith(data);
        expect(spyDisconnect).toBeCalledTimes(1);
    });
});
