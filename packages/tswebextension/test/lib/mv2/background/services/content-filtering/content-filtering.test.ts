/**
 * @jest-environment jsdom
 */

/* eslint-disable max-len */
import { CosmeticRule, NetworkRule, MatchingResult, RequestType, CosmeticResult } from '@adguard/tsurlfilter';
import { engineApi } from '@lib/mv2/background/engine-api';
import { RequestContextState, requestContextStorage } from '@lib/mv2/background/request';
import { contentFilteringService } from '@lib/mv2/background/services/content-filtering/content-filtering';
import { ContentStream } from '@lib/mv2/background/services/content-filtering/content-stream';

describe('Content filtering', () => {
    const requestId = '1';

    beforeEach(() => {
        jest.spyOn(ContentStream.prototype, 'init').mockImplementation(jest.fn);

        jest.spyOn(engineApi, 'getCosmeticResult').mockImplementation((referrerUrl: string) => {
            const cosmeticResult = new CosmeticResult();

            if (referrerUrl === 'https://hashtmlrules.org'){
                cosmeticResult.Html.append(new CosmeticRule('hashtmlrules.org$$script[tag-content="test"]', 1));
            }

            return cosmeticResult;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    beforeEach(() => {
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

    it('checks html rules', () => {
        requestContextStorage.update(requestId, {
            referrerUrl: 'https://hashtmlrules.org',
        });

        contentFilteringService.onBeforeRequest(requestId);

        expect(ContentStream.prototype.init).toBeCalledTimes(1);
    });

    it('checks html rules - invalid request type', () => {
        requestContextStorage.update(requestId, {
            referrerUrl: 'https://hashtmlrules.org',
            requestType: RequestType.Image,
        });

        contentFilteringService.onBeforeRequest(requestId);

        expect(ContentStream.prototype.init).toBeCalledTimes(0);
    });

    it('checks replace rules', () => {
        requestContextStorage.update(requestId, {
            matchingResult: new MatchingResult([new NetworkRule('||example.org^$replace=/test/test1/g', 1)], null),
        });

        contentFilteringService.onBeforeRequest(requestId);

        expect(ContentStream.prototype.init).toBeCalledTimes(1);
    });

    it('checks replace rules - invalid request type', () => {
        requestContextStorage.update(requestId, {
            matchingResult: new MatchingResult([new NetworkRule('||example.org^$replace=/test/test1/g', 1)], null),
            requestType: RequestType.Image,
        });

        contentFilteringService.onBeforeRequest(requestId);

        expect(ContentStream.prototype.init).toBeCalledTimes(0);
    });

    it('checks empty cases - no rules', () => {
        contentFilteringService.onBeforeRequest(requestId);

        expect(ContentStream.prototype.init).toBeCalledTimes(0);
    });

    it('checks empty cases - invalid method', () => {
        requestContextStorage.update(requestId, {
            matchingResult: new MatchingResult([new NetworkRule('||example.org^$replace=/test/test1/g', 1)], null),
            method: 'PUT',
        });

        contentFilteringService.onBeforeRequest(requestId);

        expect(ContentStream.prototype.init).toBeCalledTimes(0);
    });
});
