import browser from 'sinon-chrome';
import type { CosmeticResult, MatchingResult } from '@adguard/tsurlfilter';
import { EngineApi } from '@lib/mv2/background/engine-api';
import { Allowlist } from '@lib/mv2/background/allowlist';
import { DocumentApi } from '@lib/mv2/background/document-api';
import { appContext } from '@lib/mv2/background/context';
import { stealthApi } from '@lib/mv2/background/stealth-api';
import { TabsApi } from '@lib/mv2/background/tabs/tabs-api';
import { TabsCosmeticInjector } from '@lib/mv2/background/tabs/tabs-cosmetic-injector';
import { CosmeticApi } from '@lib/mv2/background/cosmetic-api';
import { ContentType } from '@lib/common/request-type';

jest.mock('@lib/mv2/background/engine-api');
jest.mock('@lib/mv2/background/allowlist');
jest.mock('@lib/mv2/background/cosmetic-api');
jest.mock('@lib/mv2/background/context');
jest.mock('@lib/mv2/background/stealth-api');
jest.mock('@lib/mv2/background/document-api');

describe('TabsCosmeticInjector', () => {
    let tabCosmeticInjector: TabsCosmeticInjector;
    let engineApi: EngineApi;

    beforeEach(() => {
        const allowlist = new Allowlist();
        engineApi = new EngineApi(allowlist, appContext, stealthApi);
        const documentApi = new DocumentApi(allowlist, engineApi);
        const tabsApi = new TabsApi(documentApi);
        tabCosmeticInjector = new TabsCosmeticInjector(engineApi, documentApi, tabsApi);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('processOpenTabs method', () => {
        it('should apply cosmetic rules for each tab', async () => {
            const tabId = 1;
            const frameId = 0;
            const url = 'https://example.com';
            const timestamp = 123;

            browser.tabs.query.resolves([{
                id: tabId,
                url,
            }]);

            browser.webNavigation.getAllFrames.resolves([{ frameId, url }]);

            const matchingResult = {} as MatchingResult;
            matchingResult.getCosmeticOption = jest.fn();

            const cosmeticResult = {} as CosmeticResult;

            jest.spyOn(engineApi, 'matchRequest').mockReturnValue(matchingResult);
            jest.spyOn(engineApi, 'getCosmeticResult').mockReturnValue(cosmeticResult);
            jest.spyOn(Date, 'now').mockReturnValue(timestamp);

            const expectedInjectionParams = {
                tabId,
                frameId,
                cosmeticResult,
            };

            const expectedLogParams = {
                url,
                tabId,
                cosmeticResult,
                timestamp,
                contentType: ContentType.Document,
            };

            await tabCosmeticInjector.processOpenTabs();

            expect(CosmeticApi.applyFrameCssRules).toBeCalledWith(expectedInjectionParams);
            expect(CosmeticApi.applyFrameJsRules).toBeCalledWith(expectedInjectionParams);
            expect(CosmeticApi.logScriptRules).toBeCalledWith(expectedLogParams);
        });

        it('should not apply cosmetic rules for non-browser tabs', async () => {
            const tabId = -1;

            browser.tabs.query.resolves([{ id: tabId }]);

            await tabCosmeticInjector.processOpenTabs();

            expect(CosmeticApi.applyFrameCssRules).not.toBeCalled();
            expect(CosmeticApi.applyFrameJsRules).not.toBeCalled();
            expect(CosmeticApi.logScriptRules).not.toBeCalled();
        });

        it('should not apply cosmetic rules for frames without src', async () => {
            const tabId = 1;
            const frameId = 1;
            const frameUrl = 'about:blank';

            browser.tabs.query.resolves([{ id: tabId }]);
            browser.webNavigation.getAllFrames.resolves([{ frameId, url: frameUrl }]);

            await tabCosmeticInjector.processOpenTabs();

            expect(CosmeticApi.applyFrameCssRules).not.toBeCalled();
            expect(CosmeticApi.applyFrameJsRules).not.toBeCalled();
            expect(CosmeticApi.logScriptRules).not.toBeCalled();
        });
    });
});
