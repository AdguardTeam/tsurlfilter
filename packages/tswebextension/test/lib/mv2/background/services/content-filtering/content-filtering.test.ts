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
import { RequestContextState, requestContextStorage } from '@lib/mv2/background/request';
import { ContentFiltering } from '@lib/mv2/background/services/content-filtering/content-filtering';
import { ContentStream } from '@lib/mv2/background/services/content-filtering/content-stream';

describe('Content filtering', () => {
    const requestId = '1';

    const getCosmeticResult = () => {
        const cosmeticResult = new CosmeticResult();

        cosmeticResult.Html.append(new CosmeticRule('example.org$$script[tag-content="test"]', 1));

        return cosmeticResult;
    };

    beforeEach(() => {
        jest.spyOn(ContentStream.prototype, 'init').mockImplementation(jest.fn);

        requestContextStorage.record(requestId, {
            state: RequestContextState.BEFORE_REQUEST,
            requestId,
            requestUrl: 'https://example.org',
            referrerUrl: 'https://example.org',
            tabId: 0,
            frameId: 0,
            timestamp: 1643639355148,
            requestType: RequestType.Document,
            method: 'GET',
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('checks html rules', () => {
        requestContextStorage.update(requestId, {
            cosmeticResult: getCosmeticResult(),
        });

        ContentFiltering.onBeforeRequest(requestId);

        expect(ContentStream.prototype.init).toBeCalledTimes(1);
    });

    it('checks replace rules', () => {
        requestContextStorage.update(requestId, {
            matchingResult: new MatchingResult([new NetworkRule('||example.org^$replace=/test/test1/g', 1)], null),
        });

        ContentFiltering.onBeforeRequest(requestId);

        expect(ContentStream.prototype.init).toBeCalledTimes(1);
    });

    it('checks replace rules - invalid request type', () => {
        requestContextStorage.update(requestId, {
            matchingResult: new MatchingResult([new NetworkRule('||example.org^$replace=/test/test1/g', 1)], null),
            requestType: RequestType.Image,
        });

        ContentFiltering.onBeforeRequest(requestId);

        expect(ContentStream.prototype.init).toBeCalledTimes(0);
    });

    it('checks empty cases - no rules', () => {
        ContentFiltering.onBeforeRequest(requestId);

        expect(ContentStream.prototype.init).toBeCalledTimes(0);
    });

    it('checks empty cases - invalid method', () => {
        requestContextStorage.update(requestId, {
            matchingResult: new MatchingResult([new NetworkRule('||example.org^$replace=/test/test1/g', 1)], null),
            method: 'PUT',
        });

        ContentFiltering.onBeforeRequest(requestId);

        expect(ContentStream.prototype.init).toBeCalledTimes(0);
    });
});
