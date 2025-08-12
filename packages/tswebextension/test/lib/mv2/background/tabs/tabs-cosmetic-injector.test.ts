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

import { TabsCosmeticInjector } from '../../../../../src/lib/mv2/background/tabs/tabs-cosmetic-injector';
import { TabsApi } from '../../../../../src/lib/mv2/background/tabs/tabs-api';
import { extSessionStorage } from '../../../../../src/lib/mv2/background/ext-session-storage';
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
    let tabsCosmeticInjector: TabsCosmeticInjector;
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
        tabsCosmeticInjector = new TabsCosmeticInjector(documentApi, tabsApi, engineApi);
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
            vi.spyOn(CosmeticApi, 'getScriptsAndScriptletsData').mockReturnValue({ scriptText: '' });
            vi.spyOn(stealthApi, 'getStealthScript').mockReturnValue('');
            vi.spyOn(Date, 'now').mockReturnValue(timestamp);

            await tabsCosmeticInjector.processOpenTabs();

            expect(CosmeticApi.applyCss).toHaveBeenCalledWith(tabId, frameId);
            expect(CosmeticApi.applyJs).toHaveBeenCalledWith(tabId, frameId);

            const expectedLogParams = {
                url,
                tabId,
                cosmeticResult,
                timestamp,
                contentType: ContentType.Document,
            };
            expect(CosmeticApi.logScriptRules).toBeCalledWith(expectedLogParams);
        });

        it('should not apply cosmetic rules for non-browser tabs', async () => {
            const tabId = -1;

            browser.tabs.query.resolves([{ id: tabId }]);

            await tabsCosmeticInjector.processOpenTabs();

            expect(CosmeticApi.applyCss).not.toBeCalled();
            expect(CosmeticApi.applyJs).not.toBeCalled();
            expect(CosmeticApi.logScriptRules).not.toBeCalled();
        });

        it('should not apply cosmetic rules for frames without src', async () => {
            const tabId = 1;
            const frameId = 1;
            const frameUrl = 'about:blank';

            browser.tabs.query.resolves([{ id: tabId }]);
            browser.webNavigation.getAllFrames.resolves([{ frameId, url: frameUrl }]);

            await tabsCosmeticInjector.processOpenTabs();

            expect(CosmeticApi.applyCss).not.toBeCalled();
            expect(CosmeticApi.applyJs).not.toBeCalled();
            expect(CosmeticApi.logScriptRules).not.toBeCalled();
        });
    });
});
