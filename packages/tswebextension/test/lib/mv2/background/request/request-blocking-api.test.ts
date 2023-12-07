import { MatchingResult, NetworkRule, RequestType } from '@adguard/tsurlfilter';
import { RequestBlockingApi } from '@lib/mv2/background/request/request-blocking-api';
import { engineApi } from '@lib/mv2/background/api';

jest.mock('@lib/mv2/background/api');

describe('Request Blocking Api', () => {
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
