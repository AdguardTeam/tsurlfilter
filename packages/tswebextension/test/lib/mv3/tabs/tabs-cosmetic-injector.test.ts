import chrome from 'sinon-chrome';
import { CosmeticResult, type MatchingResult } from '@adguard/tsurlfilter';

import { ContentType } from '../../../../src/lib/common/request-type';
import { engineApi } from '../../../../src/lib/mv3/background/engine-api';
import { TabsCosmeticInjector } from '../../../../src/lib/mv3/tabs/tabs-cosmetic-injector';
import { CosmeticApi } from '../../../../src/lib/mv3/background/cosmetic-api';
import { ScriptingApi } from '../../../../src/lib/mv3/background/scripting-api';
import { createCosmeticRule } from '../../../helpers/rule-creator';
import { appContext } from '../../../../src/lib/mv3/background/app-context';

jest.mock('@lib/mv3/background/engine-api');
jest.mock('../../../../src/lib/mv3/background/app-context');

describe('TabsCosmeticInjector', () => {
    beforeEach(() => {
        jest.spyOn(CosmeticApi, 'applyCssByTabAndFrame');
        jest.spyOn(CosmeticApi, 'applyJsByTabAndFrame');
        jest.spyOn(CosmeticApi, 'applyScriptletsByTabAndFrame');
        jest.spyOn(CosmeticApi, 'logScriptRules');
        jest.spyOn(ScriptingApi, 'insertCSS');
        jest.spyOn(ScriptingApi, 'executeScript');
        jest.spyOn(ScriptingApi, 'executeScriptlet');
    });

    afterEach(() => {
        jest.resetAllMocks();
        jest.resetModules();
    });

    describe('processOpenTabs method', () => {
        it('should apply cosmetic rules for each tab', async () => {
            const tabId = 1;
            const frameId = 0;
            const url = 'https://example.com';
            const timestamp = 123;

            chrome.tabs.query.resolves([{
                id: tabId,
                url,
            }]);

            chrome.webNavigation.getAllFrames.resolves([{ frameId, url }]);

            const matchingResult = {} as MatchingResult;
            matchingResult.getCosmeticOption = jest.fn();

            const cosmeticResult = new CosmeticResult();
            cosmeticResult.JS.append((
                createCosmeticRule("#%#console.log('test');", 1)
            ));
            cosmeticResult.CSS.append((
                createCosmeticRule('##h1', 1)
            ));

            jest.spyOn(engineApi, 'matchRequest').mockReturnValue(matchingResult);
            jest.spyOn(engineApi, 'getCosmeticResult').mockReturnValue(cosmeticResult);
            jest.spyOn(Date, 'now').mockReturnValue(timestamp);

            await TabsCosmeticInjector.processOpenTabs();

            expect(CosmeticApi.applyCssByTabAndFrame).toHaveBeenCalledWith(tabId, frameId);

            expect(CosmeticApi.applyJsByTabAndFrame).toHaveBeenCalledWith(tabId, frameId);

            expect(CosmeticApi.applyScriptletsByTabAndFrame).toHaveBeenCalledWith(tabId, frameId);

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

            chrome.tabs.query.resolves([{ id: tabId }]);

            await TabsCosmeticInjector.processOpenTabs();

            expect(CosmeticApi.applyCssByTabAndFrame).not.toBeCalled();
            expect(CosmeticApi.applyJsByTabAndFrame).not.toBeCalled();
            expect(CosmeticApi.applyScriptletsByTabAndFrame).not.toBeCalled();

            expect(CosmeticApi.logScriptRules).not.toBeCalled();
        });

        it('should not apply cosmetic rules for main frames with blank urls', async () => {
            // setting manually since resetAllMocks does not work
            appContext.cosmeticsInjectedOnStartup = false;
            const tabId = 1;
            const frameId = 1;
            const frameUrl = 'about:blank';

            chrome.tabs.query.resolves([{ id: tabId }]);
            chrome.webNavigation.getAllFrames.resolves([{ frameId, url: frameUrl }]);

            await TabsCosmeticInjector.processOpenTabs();

            expect(CosmeticApi.applyCssByTabAndFrame).toHaveBeenCalledWith(tabId, frameId);
            expect(CosmeticApi.applyJsByTabAndFrame).toHaveBeenCalledWith(tabId, frameId);
            expect(CosmeticApi.applyScriptletsByTabAndFrame).toHaveBeenCalledWith(tabId, frameId);
            expect(ScriptingApi.insertCSS).not.toBeCalled();
            expect(ScriptingApi.executeScript).not.toBeCalled();
            expect(ScriptingApi.executeScriptlet).not.toBeCalled();

            expect(CosmeticApi.logScriptRules).not.toBeCalled();
        });
    });
});
