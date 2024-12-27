import {
    describe,
    expect,
    beforeAll,
    beforeEach,
    afterEach,
    it,
    vi,
} from 'vitest';
import browser from 'sinon-chrome';
import { type CosmeticResult, type MatchingResult } from '@adguard/tsurlfilter';

import { extSessionStorage, TabsApi, TabsCosmeticInjector } from '../../../../../src/lib';
import { EngineApi } from '../../../../../src/lib/mv2/background/engine-api';
import { Allowlist } from '../../../../../src/lib/mv2/background/allowlist';
import { appContext } from '../../../../../src/lib/mv2/background/app-context';
import { stealthApi } from '../../../../../src/lib/mv2/background/stealth-api';
import { DocumentApi } from '../../../../../src/lib/mv2/background/document-api';
import { CosmeticApi } from '../../../../../src/lib/mv2/background/cosmetic-api';
import { ContentType } from '../../../../../src/lib/common/request-type';

vi.mock('../../../../../src/lib/mv2/background/engine-api');
vi.mock('../../../../../src/lib/mv2/background/allowlist');
vi.mock('../../../../../src/lib/mv2/background/cosmetic-api');
vi.mock('../../../../../src/lib/mv2/background/app-context');
vi.mock('../../../../../src/lib/mv2/background/stealth-api');
vi.mock('../../../../../src/lib/mv2/background/document-api');

describe('TabsCosmeticInjector', () => {
    let tabCosmeticInjector: TabsCosmeticInjector;
    let engineApi: EngineApi;

    beforeAll(() => {
        extSessionStorage.init();
        appContext.startTimeMs = Date.now();
    });

    beforeEach(() => {
        const allowlist = new Allowlist();
        engineApi = new EngineApi(allowlist, appContext, stealthApi);
        const documentApi = new DocumentApi(allowlist, engineApi);
        const tabsApi = new TabsApi(documentApi);
        tabCosmeticInjector = new TabsCosmeticInjector(engineApi, documentApi, tabsApi);
    });

    afterEach(() => {
        vi.resetAllMocks();
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
            matchingResult.getCosmeticOption = vi.fn();

            const cosmeticResult = {} as CosmeticResult;

            vi.spyOn(engineApi, 'matchRequest').mockReturnValue(matchingResult);
            vi.spyOn(engineApi, 'getCosmeticResult').mockReturnValue(cosmeticResult);
            vi.spyOn(Date, 'now').mockReturnValue(timestamp);

            const expectedLogParams = {
                url,
                tabId,
                cosmeticResult,
                timestamp,
                contentType: ContentType.Document,
            };

            await tabCosmeticInjector.processOpenTabs();

            expect(CosmeticApi.applyFrameCssRules).toBeCalledWith(frameId, tabId);
            expect(CosmeticApi.applyFrameJsRules).toBeCalledWith(frameId, tabId);
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
