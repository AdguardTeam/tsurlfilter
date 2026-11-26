import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import browser from 'webextension-polyfill';

import { MatchingResult, RequestType } from '@adguard/tsurlfilter';

import {
    documentBlockingService,
    engineApi,
    type GetBlockingResponseParams,
    RequestBlockingApi,
    tabsApi,
} from '../../../../../src/lib';
import { defaultFilteringLog } from '../../../../../src/lib/common/filtering-log';
import { ContentType } from '../../../../../src/lib/common/request-type';
import { createNetworkRule } from '../../../../helpers/rule-creator';

vi.mock('../../../../../src/lib/mv2/background/api');

vi.mock('../../../../../src/lib/common/filtering-log', () => ({
    defaultFilteringLog: {
        publishEvent: vi.fn(),
    },
    FilteringEventType: {
        ApplyBasicRule: 'ApplyBasicRule',
        PopupBlocked: 'PopupBlocked',
    },
}));

vi.mock('../../../../../src/lib/common/utils/rule-text-provider', () => ({
    getRuleTexts: vi.fn(() => ({
        appliedRuleText: '||example.com^$popup',
        originalRuleText: '||example.com^$popup',
    })),
}));

vi.mock('../../../../../src/lib/common/companies-db-service', () => ({
    companiesDbService: {
        match: vi.fn(() => null),
    },
}));

/**
 * Returns simple data object for {@link RequestBlockingApi.getBlockingResponse} method
 * with hardcoded values:
 * - `tabId: 1`;
 * - `eventId: '1'`;
 * - `referrerUrl: ''`.
 *
 * Other parameters are passed as arguments.
 *
 * @param rules Rules.
 * @param requestUrl Request url.
 * @param requestType Request type.
 * @param contentType Content type.
 *
 * @returns Data for getBlockingResponse() method.
 */
const getGetBlockingResponseParamsData = (
    rules: string[],
    requestUrl: string,
    requestType: RequestType,
    contentType: ContentType,
): GetBlockingResponseParams => {
    const result = new MatchingResult(
        rules.map((rule) => createNetworkRule(rule, 0)),
        null,
    );

    return {
        tabId: 1,
        eventId: '1',
        rule: result.getBasicResult(),
        popupRule: result.getPopupRule(),
        referrerUrl: '',
        requestId: '1',
        requestUrl,
        requestType,
        contentType,
    };
};

describe('Request Blocking Api - shouldCollapseElement', () => {
    const mockMatchingResult = (ruleText?: string | string[]): void => {
        let matchingResult: MatchingResult | null = null;

        if (ruleText) {
            const ruleTexts = Array.isArray(ruleText) ? ruleText : [ruleText];
            const rules = ruleTexts.map((text) => createNetworkRule(text, 0));
            matchingResult = new MatchingResult(rules, null);
        }

        vi.spyOn(engineApi, 'matchRequest').mockReturnValue(matchingResult);
    };

    it('element Should be collapsed', () => {
        mockMatchingResult('||example.org^');

        expect(
            RequestBlockingApi.shouldCollapseElement(1, 'example.org', 'example.org', RequestType.Document),
        ).toBe(true);
    });

    it('collapses a frame blocked by a rule despite a $generichide exception', () => {
        // Before the fix the cosmetic exception was the basic result, so a
        // blocked frame was never collapsed and stayed visible on the page.
        mockMatchingResult(['||ads.example.com^', '@@||example.com^$generichide']);

        expect(
            RequestBlockingApi.shouldCollapseElement(
                1,
                'https://ads.example.com/hit',
                'https://example.com/',
                RequestType.SubDocument,
            ),
        ).toBe(true);
    });

    it('iframe should not be collapsed by popup rule', () => {
        mockMatchingResult('$popup,third-party,domain=example.org');

        expect(
            RequestBlockingApi.shouldCollapseElement(1, 'https://example.com', 'https://example.org', RequestType.SubDocument),
        ).toBe(false);
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
        vi.spyOn(documentBlockingService, 'getDocumentBlockingResponse')
            .mockReturnValue(mockedBlockingPageResponse);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('blocking rule cancels a subdocument request despite a $generichide exception', () => {
        const data = getGetBlockingResponseParamsData(
            ['||ads.example.com^', '@@||example.com^$generichide'],
            'https://ads.example.com/hit',
            RequestType.SubDocument,
            ContentType.Subdocument,
        );

        expect(RequestBlockingApi.getBlockingResponse(data)).toEqual({ cancel: true });
    });

    describe('tab is new', () => {
        beforeEach(() => {
            vi.spyOn(tabsApi, 'isNewPopupTab').mockReturnValue(true);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            vi.spyOn(browser.tabs, 'remove' as any).mockResolvedValue(undefined);
        });

        afterEach(() => {
            vi.resetAllMocks();
        });

        it('the popup modifier, document request - close tab', () => {
            const rules = [
                '||example.com^',
                '||example.com^$popup',
            ];
            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual({ cancel: true });
        });

        it('does not close the tab when a $popup exception matches', () => {
            const rules = [
                '||example.com^',
                '@@||example.com^$popup',
            ];
            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );

            // The popup slot holds an allowlist rule: it disables closing, so the
            // main page is not blocked either (a plain rule does not permit
            // document requests).
            expect(RequestBlockingApi.getBlockingResponse(data)).toBeUndefined();
        });

        it('explicit modifiers popup and document, document request - close tab', () => {
            const rules = [
                '||example.com^$popup,document',
                '||example.com^',
            ];

            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            // a new tab should be cancelled due to 'Popup' option enabled
            expect(response).toEqual({ cancel: true });
        });

        it('the all modifier, document request - close tab', () => {
            const rules = ['||example.com^$all'];
            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            // $all is actually a synonym for $popup,document
            // so a new tab should be cancelled due to 'popup' option enabled
            expect(response).toEqual({ cancel: true });
        });

        it('the all modifier and popup modifier document request - close tab', () => {
            const rules = [
                '||example.com^$all',
                '||example.com^$popup',
            ];
            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual({ cancel: true });
        });

        it('blocking rule, document modifier, document request - blocking page', () => {
            const rules = ['||example.com^$document'];
            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual(mockedBlockingPageResponse);
        });

        it('the popup modifier, image request - bypass request', () => {
            const rules = ['||example.com^$popup'];
            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com/image.png',
                RequestType.Image,
                ContentType.Image,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual(undefined);
        });

        it('wide popup modifier rule, image request - bypass request', () => {
            const rules = ['|http*://$popup'];
            const data = getGetBlockingResponseParamsData(
                rules,
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
            const rules = ['||example.com^'];
            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual(undefined);
        });

        it('basic rule, subdocument - should be cancelled', () => {
            const rules = ['||example.com^'];

            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com',
                RequestType.SubDocument,
                ContentType.Subdocument,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual({ cancel: true });
        });

        it('basic rule, subrequest - should be cancelled', () => {
            const rules = ['||example.com^'];
            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com',
                RequestType.XmlHttpRequest,
                ContentType.XmlHttpRequest,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual({ cancel: true });
        });

        it('basic rule, script request - should be cancelled', () => {
            const rules = ['||example.com/script.js'];
            const data = getGetBlockingResponseParamsData(
                rules,
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
            vi.spyOn(tabsApi, 'isNewPopupTab').mockReturnValue(false);
        });

        afterEach(() => {
            vi.resetAllMocks();
        });

        it('just popup modifier, document request - do not close tab, undefined is returned', () => {
            const rules = ['||example.com^$popup'];
            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual(undefined);
        });

        it('the all modifier, document request - blocking page', () => {
            const rules = ['||example.com^$all'];
            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual(mockedBlockingPageResponse);
        });

        it('the all modifier and popup modifier, document request - blocking page', () => {
            const rules = [
                '||example.com^$all',
                '||example.com^$popup',
            ];
            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual(mockedBlockingPageResponse);
        });

        it('the all modifier and popup modifier with document, document request - blocking page', () => {
            const rules = [
                '||example.com^$all',
                '||example.com^$popup,document',
            ];
            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual(mockedBlockingPageResponse);
        });

        it('show blocking page if tab is not new', () => {
            const rules = ['||example.com^$popup,document'];
            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual(mockedBlockingPageResponse);
        });

        it('basic rule and explicit popup with document, document request - blocking page', () => {
            const rules = [
                '||example.com^',
                '||example.com^$popup,document',
            ];
            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual(mockedBlockingPageResponse);
        });

        it('blocking rule, document modifier, document request - blocking page', () => {
            const rules = ['||example.com^$document'];
            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual(mockedBlockingPageResponse);
        });

        it('the popup modifier, image request - do nothing', () => {
            const rules = ['||example.com^$popup'];
            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com/image.png',
                RequestType.Image,
                ContentType.Image,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual(undefined);
        });

        it('wide popup modifier rule, image request - do nothing', () => {
            const rules = ['|http*://$popup'];
            const data = getGetBlockingResponseParamsData(
                rules,
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
            const rules = ['||example.com^'];
            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual(undefined);
        });

        it('basic rule, subdocument - should be cancelled', () => {
            const rules = ['||example.com^'];
            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com',
                RequestType.SubDocument,
                ContentType.Subdocument,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual({ cancel: true });
        });

        it('basic rule, subrequest - should be cancelled', () => {
            const rules = ['||example.com^'];
            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com',
                RequestType.XmlHttpRequest,
                ContentType.XmlHttpRequest,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual({ cancel: true });
        });

        it('simple basic rule, script request - should be cancelled', () => {
            const rules = ['||example.com/script.js'];
            const data = getGetBlockingResponseParamsData(
                rules,
                'http://example.com/script.js',
                RequestType.Script,
                ContentType.Script,
            );
            const response = RequestBlockingApi.getBlockingResponse(data);
            expect(response).toEqual({ cancel: true });
        });
    });
});

describe('Request Blocking Api - closeTab publishes PopupBlocked event (AG-3736)', () => {
    let tabsRemoveSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.spyOn(tabsApi, 'isNewPopupTab').mockReturnValue(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tabsRemoveSpy = vi.spyOn(browser.tabs, 'remove' as any).mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it('publishes PopupBlocked for $popup rule with the real tabId, removes the actual tab', () => {
        const TAB_ID = 42;
        const data = {
            ...getGetBlockingResponseParamsData(
                ['||example.com^$popup'],
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            ),
            tabId: TAB_ID,
        };

        RequestBlockingApi.getBlockingResponse(data);

        // The actual tab should be removed.
        expect(tabsRemoveSpy).toHaveBeenCalledWith(TAB_ID);

        // The filtering log event must be PopupBlocked and carry the real tabId.
        // The consumer (e.g. browser extension) is responsible for attaching it
        // to the background page.
        expect(defaultFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'PopupBlocked',
                data: expect.objectContaining({
                    tabId: TAB_ID,
                }),
            }),
        );
        expect(defaultFilteringLog.publishEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'ApplyBasicRule',
            }),
        );
    });

    it('publishes PopupBlocked for $all rule with the real tabId, removes the actual tab', () => {
        const TAB_ID = 7;
        const data = {
            ...getGetBlockingResponseParamsData(
                ['||example.com^$all'],
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            ),
            tabId: TAB_ID,
        };

        RequestBlockingApi.getBlockingResponse(data);

        expect(tabsRemoveSpy).toHaveBeenCalledWith(TAB_ID);
        expect(defaultFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'PopupBlocked',
                data: expect.objectContaining({
                    tabId: TAB_ID,
                }),
            }),
        );
    });

    it('publishes PopupBlocked for explicit $popup,$document rule with the real tabId, removes the actual tab', () => {
        const TAB_ID = 15;
        const data = {
            ...getGetBlockingResponseParamsData(
                ['||example.com^$popup,document', '||example.com^'],
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            ),
            tabId: TAB_ID,
        };

        RequestBlockingApi.getBlockingResponse(data);

        expect(tabsRemoveSpy).toHaveBeenCalledWith(TAB_ID);
        expect(defaultFilteringLog.publishEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'PopupBlocked',
                data: expect.objectContaining({
                    tabId: TAB_ID,
                }),
            }),
        );
    });

    it('does not publish duplicate PopupBlocked event during redirect race', () => {
        const TAB_ID = 99;
        let resolveRemove: () => void;
        tabsRemoveSpy.mockImplementation(() => new Promise<void>((resolve) => {
            resolveRemove = resolve;
        }));

        const data = {
            ...getGetBlockingResponseParamsData(
                ['||example.com^$popup'],
                'http://example.com',
                RequestType.Document,
                ContentType.Document,
            ),
            tabId: TAB_ID,
        };

        RequestBlockingApi.getBlockingResponse(data);
        expect(tabsRemoveSpy).toHaveBeenCalledTimes(1);
        expect(defaultFilteringLog.publishEvent).toHaveBeenCalledTimes(1);

        // Simulate a second onBeforeRequest arriving before tabs.remove resolves.
        RequestBlockingApi.getBlockingResponse(data);
        expect(tabsRemoveSpy).toHaveBeenCalledTimes(1);
        expect(defaultFilteringLog.publishEvent).toHaveBeenCalledTimes(1);

        resolveRemove!();
    });
});
