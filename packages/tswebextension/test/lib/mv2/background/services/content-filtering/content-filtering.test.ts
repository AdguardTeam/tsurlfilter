/**
 * @vitest-environment jsdom
 */
import {
    describe,
    expect,
    beforeEach,
    afterEach,
    it,
    vi,
} from 'vitest';
import {
    MatchingResult,
    RequestType,
    CosmeticResult,
    HTTPMethod,
    type NetworkRule,
} from '@adguard/tsurlfilter';

import { createCosmeticRule, createNetworkRule } from '../../../../../helpers/rule-creator';
import { type RequestContext, RequestContextState } from '../../../../../../src/lib';
import { ContentStream } from '../../../../../../src/lib/mv2/background/services/content-filtering/content-stream';
import {
    ContentFiltering,
} from '../../../../../../src/lib/mv2/background/services/content-filtering/content-filtering';
import { contentFiltering } from '../../../../../../src/lib/mv2/background/api';
import { ContentType } from '../../../../../../src/lib/common/request-type';

describe('Content filtering', () => {
    const requestContext: RequestContext = {
        eventId: '1',
        state: RequestContextState.BeforeRequest,
        requestId: '1',
        requestUrl: 'https://example.org',
        referrerUrl: 'https://example.org',
        tabId: 0,
        frameId: 0,
        requestFrameId: 0,
        timestamp: 1643639355148,
        requestType: RequestType.Document,
        method: HTTPMethod.GET,
        contentType: ContentType.Document,
        thirdParty: false,
    };

    const getCosmeticResult = (): CosmeticResult => {
        const cosmeticResult = new CosmeticResult();

        cosmeticResult.Html.append(createCosmeticRule('example.org$$script[tag-content="test"]', 1));

        return cosmeticResult;
    };

    beforeEach(() => {
        vi.spyOn(ContentStream.prototype, 'init').mockImplementation(vi.fn);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('checks html rules', () => {
        contentFiltering.process({
            ...requestContext,
            cosmeticResult: getCosmeticResult(),
        });

        expect(ContentStream.prototype.init).toBeCalledTimes(1);
    });

    it('checks replace rules', () => {
        contentFiltering.process({
            ...requestContext,
            matchingResult: new MatchingResult([createNetworkRule('||example.org^$replace=/test/test1/g', 1)], null),
        });

        expect(ContentStream.prototype.init).toBeCalledTimes(1);
    });

    it('checks replace rules - invalid request type', () => {
        contentFiltering.process({
            ...requestContext,
            matchingResult: new MatchingResult([createNetworkRule('||example.org^$replace=/test/test1/g', 1)], null),
            requestType: RequestType.Image,
        });

        expect(ContentStream.prototype.init).toBeCalledTimes(0);
    });

    it('checks empty cases - no rules', () => {
        contentFiltering.process(requestContext);

        expect(ContentStream.prototype.init).toBeCalledTimes(0);
    });

    it('checks empty cases - invalid method', () => {
        contentFiltering.process({
            ...requestContext,
            matchingResult: new MatchingResult([createNetworkRule('||example.org^$replace=/test/test1/g', 1)], null),
            method: HTTPMethod.PUT,
        });

        expect(ContentStream.prototype.init).toBeCalledTimes(0);
    });

    it('checks empty cases - allowlisted by content modifier', () => {
        contentFiltering.process({
            ...requestContext,
            matchingResult: new MatchingResult(
                [createNetworkRule('||example.org^$replace=/test/test1/g', 1)],
                createNetworkRule('@@||example.org^$content', 1),
            ),
        });

        expect(ContentStream.prototype.init).toBeCalledTimes(0);
    });

    it('check sorting of replace rules', () => {
        const replaceRules = [
            createNetworkRule('||example.org^$replace=/test3/test4/g', 1, 1),
            createNetworkRule('||example.org^$replace=/test1/test2/g', 1, 2),
            createNetworkRule('||example.org^$replace=/test2/test3/g', 1, 3),
        ];

        const expectedSortedRules: number[] = [2, 3, 1];

        // @ts-expect-error - spying on private static method
        const contentStringFilterConstructorSpy = vi.spyOn(ContentFiltering, 'getReplaceRules');

        contentFiltering.process({
            ...requestContext,
            matchingResult: new MatchingResult(replaceRules, null),
        });

        expect(contentStringFilterConstructorSpy).toBeCalledTimes(1);
        expect(contentStringFilterConstructorSpy.mock.results[0].value).not.toBeNull();
        expect(
            contentStringFilterConstructorSpy.mock.results[0].value.map((rule: NetworkRule) => rule.getIndex()),
        ).toEqual(expectedSortedRules);
    });
});
