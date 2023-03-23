/**
 * @jest-environment jsdom
 */
import {
    NetworkRule,
    MatchingResult,
    RequestType,
    CosmeticResult,
    CosmeticRule,
} from '@adguard/tsurlfilter';
import { ContentType } from '@lib/common';
import { type RequestContext, RequestContextState } from '@lib/mv2/background/request';
import { ContentFiltering } from '@lib/mv2/background/services/content-filtering/content-filtering';
import { ContentStream } from '@lib/mv2/background/services/content-filtering/content-stream';

describe('Content filtering', () => {
    const requestContext: RequestContext = {
        state: RequestContextState.BeforeRequest,
        requestId: '1',
        requestUrl: 'https://example.org',
        referrerUrl: 'https://example.org',
        tabId: 0,
        frameId: 0,
        requestFrameId: 0,
        timestamp: 1643639355148,
        requestType: RequestType.Document,
        method: 'GET',
        contentType: ContentType.Document,
        thirdParty: false,
    };

    const getCosmeticResult = (): CosmeticResult => {
        const cosmeticResult = new CosmeticResult();

        cosmeticResult.Html.append(new CosmeticRule('example.org$$script[tag-content="test"]', 1));

        return cosmeticResult;
    };

    beforeEach(() => {
        jest.spyOn(ContentStream.prototype, 'init').mockImplementation(jest.fn);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('checks html rules', () => {
        ContentFiltering.onBeforeRequest({
            ...requestContext,
            cosmeticResult: getCosmeticResult(),
        });

        expect(ContentStream.prototype.init).toBeCalledTimes(1);
    });

    it('checks replace rules', () => {
        ContentFiltering.onBeforeRequest({
            ...requestContext,
            matchingResult: new MatchingResult([new NetworkRule('||example.org^$replace=/test/test1/g', 1)], null),
        });

        expect(ContentStream.prototype.init).toBeCalledTimes(1);
    });

    it('checks replace rules - invalid request type', () => {
        ContentFiltering.onBeforeRequest({
            ...requestContext,
            matchingResult: new MatchingResult([new NetworkRule('||example.org^$replace=/test/test1/g', 1)], null),
            requestType: RequestType.Image,
        });

        expect(ContentStream.prototype.init).toBeCalledTimes(0);
    });

    it('checks empty cases - no rules', () => {
        ContentFiltering.onBeforeRequest(requestContext);

        expect(ContentStream.prototype.init).toBeCalledTimes(0);
    });

    it('checks empty cases - invalid method', () => {
        ContentFiltering.onBeforeRequest({
            ...requestContext,
            matchingResult: new MatchingResult([new NetworkRule('||example.org^$replace=/test/test1/g', 1)], null),
            method: 'PUT',
        });

        expect(ContentStream.prototype.init).toBeCalledTimes(0);
    });

    it('checks empty cases - allowlisted by content modifier', () => {
        ContentFiltering.onBeforeRequest({
            ...requestContext,
            matchingResult: new MatchingResult(
                [new NetworkRule('||example.org^$replace=/test/test1/g', 1)],
                new NetworkRule('@@||example.org^$content', 1),
            ),
        });

        expect(ContentStream.prototype.init).toBeCalledTimes(0);
    });
});
