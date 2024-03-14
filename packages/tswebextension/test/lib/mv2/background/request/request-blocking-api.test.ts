import { MatchingResult, NetworkRule, RequestType } from '@adguard/tsurlfilter';
import { type GetBlockingResponseParams, RequestBlockingApi } from '@lib/mv2/background/request/request-blocking-api';
import { documentBlockingService, engineApi, tabsApi } from '@lib/mv2/background/api';
import { ContentType } from '@lib/common';

jest.mock('@lib/mv2/background/api');

/**
 * Returns simple data object for {@link RequestBlockingApi.getBlockingResponse} method
 * with hardcoded values:
 * - `tabId: 1`;
 * - `eventId: '1'`;
 * - `referrerUrl: ''`.
 *
 * Other parameters are passed as arguments.
 *
 * @param ruleText Rule text.
 * @param requestUrl Request url.
 * @param requestType Request type.
 * @param contentType Content type.
 *
 * @returns Data for getBlockingResponse() method.
 */
const getGetBlockingResponseParamsData = (
    ruleText: string,
    requestUrl: string,
    requestType: RequestType,
    contentType: ContentType,
): GetBlockingResponseParams => {
    return {
        tabId: 1,
        eventId: '1',
        rule: new NetworkRule(ruleText, 0),
        referrerUrl: '',
        requestUrl,
        requestType,
        contentType,
    };
};

describe('Request Blocking Api - shouldCollapseElement', () => {
    const mockMatchingResult = (ruleText?: string): void => {
        let matchingResult = null;

        if (ruleText) {
            const rule = new NetworkRule(ruleText, 0);
            matchingResult = new MatchingResult([rule], null);
        }

        jest.spyOn(engineApi, 'matchRequest').mockReturnValue(matchingResult);
    };

    it('element Should be collapsed', () => {
        mockMatchingResult('||example.org^');

        expect(
            RequestBlockingApi.shouldCollapseElement(1, 'example.org', 'example.org', RequestType.Document),
        ).toBe(true);
    });

    it('element without rule match shouldn`t be collapsed', () => {
        mockMatchingResult();

        expect(
            RequestBlockingApi.shouldCollapseElement(1, 'example.org', 'example.org', RequestType.Document),
        ).toBe(false);
    });

    it('element with allowlist rule match shouldn`t be collapsed', () => {
        mockMatchingResult('@@||example.org^');

        expect(
            RequestBlockingApi.shouldCollapseElement(1, 'example.org', 'example.org', RequestType.Document),
        ).toBe(false);
    });

    it('element with redirect rule match shouldn`t be collapsed', () => {
        mockMatchingResult('||example.org/script.js$script,redirect=noopjs');

        expect(
            RequestBlockingApi.shouldCollapseElement(1, 'example.org', 'example.org', RequestType.Document),
        ).toBe(false);
    });

    it('element with replace rule match shouldn`t be collapsed', () => {
        mockMatchingResult('||example.org^$replace=/X/Y/');

        expect(
            RequestBlockingApi.shouldCollapseElement(1, 'example.org', 'example.org', RequestType.Document),
        ).toBe(false);
    });
});

describe('Request Blocking Api - getBlockingResponse', () => {
    const BLOCKING_PAGE_RESPONSE_MARKER = 'BLOCKING_PAGE';
    const mockedBlockingPageResponse = {
        cancel: true,
        redirectUrl: BLOCKING_PAGE_RESPONSE_MARKER,
    };

    beforeEach(() => {
        jest.spyOn(documentBlockingService, 'getDocumentBlockingResponse')
            .mockReturnValue(mockedBlockingPageResponse);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('tab is new', () => {
        beforeEach(() => {
            jest.spyOn(tabsApi, 'isNewPopupTab').mockReturnValue(true);
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('the popup modifier, document request - close tab', () => {
            const data = getGetBlockingResponseParamsData(
                '||example.com^$popup',
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual({ cancel: true });
        });

        it('the all modifier, document request - close tab', () => {
            const data = getGetBlockingResponseParamsData(
                '||example.com^$all',
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            // $all is actually a synonym for $popup,document
            // so a new tab should be cancelled due to 'Popup' option enabled
            expect(response).toEqual({ cancel: true });
        });

        it('explicit modifiers popup and document, document request - close tab', () => {
            const data = getGetBlockingResponseParamsData(
                '||example.com^$popup,document',
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            // a new tab should be cancelled due to 'Popup' option enabled
            expect(response).toEqual({ cancel: true });
        });

        it('blocking rule, document modifier, document request - blocking page', () => {
            const data = getGetBlockingResponseParamsData(
                '||example.com^$document',
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual(mockedBlockingPageResponse);
        });

        it('the popup modifier, image request - cancel request', () => {
            const data = getGetBlockingResponseParamsData(
                '||example.com^$popup',
                'http://example.com/image.png',
                RequestType.Image,
                ContentType.Image,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual({ cancel: true });
        });

        it('wide popup modifier rule, image request - close tab', () => {
            const data = getGetBlockingResponseParamsData(
                '|http*://$popup',
                'http://example.com/image.png',
                RequestType.Image,
                ContentType.Image,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual({ cancel: true });
        });

        it('basic rule, main document request - should NOT be cancelled', () => {
            // Basic rules for blocking requests are applied only to sub-requests,
            // not to main frame which is loaded as document request type.
            // https://adguard.com/kb/general/ad-filtering/create-own-filters/#basic-rules
            const data = getGetBlockingResponseParamsData(
                '||example.com^',
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual(undefined);
        });

        it('basic rule, subdocument - should be cancelled', () => {
            const data = getGetBlockingResponseParamsData(
                '||example.com^',
                'http://example.com',
                RequestType.SubDocument,
                ContentType.Subdocument,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual({ cancel: true });
        });

        it('basic rule, subrequest - should be cancelled', () => {
            const data = getGetBlockingResponseParamsData(
                '||example.com^',
                'http://example.com',
                RequestType.XmlHttpRequest,
                ContentType.XmlHttpRequest,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual({ cancel: true });
        });

        it('basic rule, script request - should be cancelled', () => {
            const data = getGetBlockingResponseParamsData(
                '||example.com/script.js',
                'http://example.com/script.js',
                RequestType.Script,
                ContentType.Script,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual({ cancel: true });
        });
    });

    describe('tab is not new', () => {
        beforeEach(() => {
            jest.spyOn(tabsApi, 'isNewPopupTab').mockReturnValue(false);
        });

        afterEach(() => {
            jest.resetAllMocks();
        });

        it('just popup modifier, document request - do not close tab, undefined is returned', () => {
            const data = getGetBlockingResponseParamsData(
                '||example.com^$popup',
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual(undefined);
        });

        it('the all modifier, document request - blocking page', () => {
            const data = getGetBlockingResponseParamsData(
                '||example.com^$all',
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual(mockedBlockingPageResponse);
        });

        // TODO: Uncomment this case
        // it('explicit popup with document, document request - blocking page', () => {
        //     const data = getGetBlockingResponseParamsData(
        //         '||example.com^$popup,document',
        //         'http://example.com',
        //         RequestType.Document,
        //         ContentType.Document,
        //     );
        //     const response = RequestBlockingApi.getBlockingResponse(data);
        //     expect(response).toEqual(mockedBlockingPageResponse);
        // });

        it('blocking rule, document modifier, document request - blocking page', () => {
            const data = getGetBlockingResponseParamsData(
                '||example.com^$document',
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual(mockedBlockingPageResponse);
        });

        it('the popup modifier, image request - do nothing', () => {
            const data = getGetBlockingResponseParamsData(
                '||example.com^$popup',
                'http://example.com/image.png',
                RequestType.Image,
                ContentType.Image,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual(undefined);
        });

        it('wide popup modifier rule, image request - do nothing', () => {
            const data = getGetBlockingResponseParamsData(
                '|http*://$popup',
                'http://example.com/image.png',
                RequestType.Image,
                ContentType.Image,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual(undefined);
        });

        it('basic rule, main document request - should NOT be cancelled', () => {
            // Basic rules for blocking requests are applied only to sub-requests,
            // not to main frame which is loaded as document request type.
            // https://adguard.com/kb/general/ad-filtering/create-own-filters/#basic-rules
            const data = getGetBlockingResponseParamsData(
                '||example.com^',
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual(undefined);
        });

        it('basic rule, subdocument - should be cancelled', () => {
            const data = getGetBlockingResponseParamsData(
                '||example.com^',
                'http://example.com',
                RequestType.SubDocument,
                ContentType.Subdocument,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual({ cancel: true });
        });

        it('basic rule, subrequest - should be cancelled', () => {
            const data = getGetBlockingResponseParamsData(
                '||example.com^',
                'http://example.com',
                RequestType.XmlHttpRequest,
                ContentType.XmlHttpRequest,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual({ cancel: true });
        });

        it('simple basic rule, script request - should be cancelled', () => {
            const data = getGetBlockingResponseParamsData(
                '||example.com/script.js',
                'http://example.com/script.js',
                RequestType.Script,
                ContentType.Script,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual({ cancel: true });
        });
    });
});
