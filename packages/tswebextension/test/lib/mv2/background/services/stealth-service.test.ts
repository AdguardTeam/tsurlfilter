import {
    describe,
    expect,
    beforeEach,
    it,
} from 'vitest';
import { type WebRequest } from 'webextension-polyfill';
import {
    type NetworkRule,
    HTTPMethod,
    MatchingResult,
    RequestType,
    StealthOptionName,
} from '@adguard/tsurlfilter';
import { minify } from 'terser';

import { createNetworkRule } from '../../../../helpers/rule-creator';
import { MockFilteringLog } from '../../../common/mocks/mock-filtering-log';
import { mockEngineApi } from '../../../../helpers/mocks';
import { type AppContext } from '../../../../../src/lib/mv2/background/app-context';
import { ContentType } from '../../../../../src/lib/common/request-type';
import { nanoid } from '../../../../../src/lib/common/utils/nanoid';
import { StealthService } from '../../../../../src/lib/mv2/background/services/stealth-service';
import { StealthActions } from '../../../../../src/lib/common/stealth-actions';
import {
    type RequestContext,
    RequestContextState,
} from '../../../../../src/lib/mv2/background/request/request-context-storage';

type TestAppContext = AppContext & { configuration: NonNullable<AppContext['configuration']> };
describe('Stealth service', () => {
    let appContext: TestAppContext;

    const filteringLog = new MockFilteringLog();

    beforeEach(() => {
        appContext = {
            configuration: {
                settings: {
                    stealth: {
                        blockChromeClientData: false,
                        hideReferrer: false,
                        hideSearchQueries: false,
                        sendDoNotTrack: false,
                        selfDestructThirdPartyCookies: false,
                        selfDestructThirdPartyCookiesTime: 0,
                        selfDestructFirstPartyCookies: false,
                        selfDestructFirstPartyCookiesTime: 0,
                        blockWebRTC: false,
                    },
                },
            },
        } as TestAppContext;
    });

    describe('Cookies', () => {
        it('returns first-party cookies', () => {
            appContext.configuration.settings.stealth.selfDestructFirstPartyCookies = true;
            appContext.configuration.settings.stealth.selfDestructFirstPartyCookiesTime = 1;

            const service = new StealthService(appContext, filteringLog, mockEngineApi);

            const cookieRulesTexts = service.getCookieRulesTexts();
            expect(cookieRulesTexts).toHaveLength(1);
            expect(cookieRulesTexts[0]).toBe('$cookie=/.+/;maxAge=60');
        });

        it('returns third-party cookies', () => {
            appContext.configuration.settings.stealth.selfDestructFirstPartyCookies = false;
            appContext.configuration.settings.stealth.selfDestructFirstPartyCookiesTime = 0;

            appContext.configuration.settings.stealth.selfDestructThirdPartyCookies = true;
            appContext.configuration.settings.stealth.selfDestructThirdPartyCookiesTime = 1;

            let service = new StealthService(appContext, filteringLog, mockEngineApi);

            let cookieRules = service.getCookieRulesTexts();
            expect(cookieRules).toHaveLength(1);
            expect(cookieRules[0]).toBe('$cookie=/.+/;maxAge=60,third-party');

            appContext.configuration.settings.stealth.selfDestructThirdPartyCookies = true;
            appContext.configuration.settings.stealth.selfDestructThirdPartyCookiesTime = 0;

            service = new StealthService(appContext, filteringLog, mockEngineApi);

            cookieRules = service.getCookieRulesTexts();
            expect(cookieRules).toHaveLength(1);
            expect(cookieRules[0]).toBe('$cookie=/.+/,third-party');
        });

        it('returns third-party and first-party cookies together', () => {
            appContext.configuration.settings.stealth.selfDestructFirstPartyCookies = true;
            appContext.configuration.settings.stealth.selfDestructFirstPartyCookiesTime = 0;
            appContext.configuration.settings.stealth.selfDestructThirdPartyCookies = true;
            appContext.configuration.settings.stealth.selfDestructThirdPartyCookiesTime = 1;

            const service = new StealthService(appContext, filteringLog, mockEngineApi);

            const cookieRules = service.getCookieRulesTexts();
            expect(cookieRules).toHaveLength(2);
            expect(cookieRules.some((rule) => rule === '$cookie=/.+/;maxAge=60,third-party')).toBeTruthy();
            expect(cookieRules.some((rule) => rule === '$cookie=/.+/')).toBeTruthy();
        });
    });

    describe('Stealth service - headers', () => {
        const getContextWithHeaders = (headers: WebRequest.HttpHeaders, rules?: NetworkRule[]): RequestContext => {
            return {
                eventId: nanoid(),
                state: RequestContextState.BeforeSendHeaders,
                requestId: '1',
                requestUrl: 'https://example.org',
                referrerUrl: 'https://example.org',
                requestType: RequestType.Document,
                contentType: ContentType.Document,
                statusCode: 200,
                tabId: 0,
                frameId: 0,
                requestFrameId: 0,
                timestamp: Date.now(),
                thirdParty: false,
                matchingResult: new MatchingResult(rules || [], null),
                cookies: undefined,
                contentTypeHeader: undefined,
                method: HTTPMethod.GET,
                requestHeaders: headers,
            };
        };

        beforeEach(() => {
            appContext.configuration.settings.stealth = {
                blockChromeClientData: false,
                hideReferrer: false,
                hideSearchQueries: false,
                sendDoNotTrack: false,
                selfDestructThirdPartyCookies: false,
                selfDestructThirdPartyCookiesTime: 0,
                selfDestructFirstPartyCookies: false,
                selfDestructFirstPartyCookiesTime: 0,
                blockWebRTC: false,
            };
        });

        it('checks hide referrer', () => {
            appContext.configuration.settings.stealth.hideReferrer = true;
            const service = new StealthService(appContext, filteringLog, mockEngineApi);

            expect(service.processRequestHeaders(getContextWithHeaders([{
                name: 'Referer',
                value: 'http://example.org',
            }]))).toBe(0);

            expect(service.processRequestHeaders(getContextWithHeaders([{
                name: 'Referer',
                value: 'http://other.org',
            }]))).toBe(StealthActions.HideReferrer);
        });

        it('checks hide search query', () => {
            appContext.configuration.settings.stealth.hideSearchQueries = true;
            const service = new StealthService(appContext, filteringLog, mockEngineApi);

            expect(service.processRequestHeaders(getContextWithHeaders([{
                name: 'Referer',
                value: 'http://other.org',
            }]))).toBe(0);

            expect(service.processRequestHeaders(getContextWithHeaders([{
                name: 'Referer',
                value: 'http://www.google.com',
            }]))).toBe(StealthActions.HideSearchQueries);
        });

        it('checks block chrome client data', () => {
            appContext.configuration.settings.stealth.blockChromeClientData = true;
            const service = new StealthService(appContext, filteringLog, mockEngineApi);

            expect(service.processRequestHeaders(getContextWithHeaders([{
                name: 'X-Client-Data',
                value: 'some data',
            }]))).toBe(StealthActions.BlockChromeClientData);
        });

        it('checks send-do-not-track', () => {
            appContext.configuration.settings.stealth.sendDoNotTrack = true;
            const service = new StealthService(appContext, filteringLog, mockEngineApi);

            const context = getContextWithHeaders([]);

            expect(service.processRequestHeaders(context)).toBe(StealthActions.SendDoNotTrack);
            expect(context.requestHeaders).toHaveLength(2);
            expect(context.requestHeaders![0].name).toBe('DNT');
            expect(context.requestHeaders![0].value).toBe('1');
            expect(context.requestHeaders![1].name).toBe('Sec-GPC');
            expect(context.requestHeaders![1].value).toBe('1');
        });

        describe('disabling stealth options with rules', () => {
            it('disables all options with $stealth rule', () => {
                appContext.configuration.settings.stealth.hideReferrer = true;
                appContext.configuration.settings.stealth.blockChromeClientData = true;
                appContext.configuration.settings.stealth.sendDoNotTrack = true;

                const service = new StealthService(appContext, filteringLog, mockEngineApi);
                const referrerHeader = {
                    name: 'Referer',
                    value: 'http://other.org',
                };
                const xClientDataHeader = {
                    name: 'X-Client-Data',
                    value: 'some data',
                };

                const searchQueryHeader = {
                    name: 'Referer',
                    value: 'http://www.google.com',
                };

                let context = getContextWithHeaders([referrerHeader, xClientDataHeader, searchQueryHeader]);
                const stealthActions = service.processRequestHeaders(context);
                expect(stealthActions & StealthActions.BlockChromeClientData).toBeTruthy();
                expect(stealthActions & StealthActions.HideReferrer).toBeTruthy();
                expect(stealthActions & StealthActions.BlockChromeClientData).toBeTruthy();

                context = getContextWithHeaders([referrerHeader], [
                    createNetworkRule('@@||example.org$stealth', 0),
                ]);
                expect(service.processRequestHeaders(context)).toBe(StealthActions.None);
            });

            it('disables specific options', () => {
                appContext.configuration.settings.stealth.hideReferrer = true;
                appContext.configuration.settings.stealth.blockChromeClientData = true;
                appContext.configuration.settings.stealth.sendDoNotTrack = true;

                const rule = `@@||example.org$stealth=${StealthOptionName.HideReferrer}`;
                const service = new StealthService(appContext, filteringLog, mockEngineApi);
                const referrerHeader = {
                    name: 'Referer',
                    value: 'http://other.org',
                };
                const xClientDataHeader = {
                    name: 'X-Client-Data',
                    value: 'some data',
                };

                const searchQueryHeader = {
                    name: 'Referer',
                    value: 'http://www.google.com',
                };

                const context = getContextWithHeaders(
                    [referrerHeader, xClientDataHeader, searchQueryHeader],
                    [createNetworkRule(rule, 0)],
                );
                const stealthActions = service.processRequestHeaders(context);
                expect(stealthActions & StealthActions.BlockChromeClientData).toBeTruthy();
                expect(stealthActions & StealthActions.BlockChromeClientData).toBeTruthy();
                expect(stealthActions & StealthActions.HideReferrer).toBeFalsy();
            });
        });

        it('checks global GPC value in the navigator', async () => {
            appContext.configuration.settings.stealth.sendDoNotTrack = true;
            const service = new StealthService(appContext, filteringLog, mockEngineApi);

            // Here we check that the function is written correctly in the
            // string, to avoid changing its form to a lambda function, for
            // example.
            const funcTxt = service.getSetDomSignalScript();

            const expectedFuncTxt = `;(function setDomSignal() {
                try {
                  if ('globalPrivacyControl' in Navigator.prototype) {
                    return;
                  }
                  Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', {
                    get: ()=>true,
                    configurable: true,
                    enumerable: true
                  });
                } catch (ex) {
                  // Ignore
                }
              })();`;

            expect((await minify(funcTxt)).code).toBe((await minify(expectedFuncTxt)).code);
        });
    });
});
