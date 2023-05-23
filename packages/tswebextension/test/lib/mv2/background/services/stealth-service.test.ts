import { WebRequest } from 'webextension-polyfill';
import { MatchingResult, RequestType } from '@adguard/tsurlfilter';

import { ContentType } from '@lib/common';
import { RequestContext, RequestContextState } from '@lib/mv2';
import { StealthActions, StealthService } from '@lib/mv2/background/services/stealth-service';

import type { AppContext } from '@lib/mv2/background/context';
import { MockFilteringLog } from '../../../common/mocks/mock-filtering-log';

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

            const service = new StealthService(appContext, filteringLog);

            const cookieRulesTexts = service.getCookieRulesTexts();
            expect(cookieRulesTexts).toHaveLength(1);
            expect(cookieRulesTexts[0]).toBe('$cookie=/.+/;maxAge=60');
        });

        it('returns third-party cookies', () => {
            appContext.configuration.settings.stealth.selfDestructFirstPartyCookies = false;
            appContext.configuration.settings.stealth.selfDestructFirstPartyCookiesTime = 0;

            appContext.configuration.settings.stealth.selfDestructThirdPartyCookies = true;
            appContext.configuration.settings.stealth.selfDestructThirdPartyCookiesTime = 1;

            let service = new StealthService(appContext, filteringLog);

            let cookieRules = service.getCookieRulesTexts();
            expect(cookieRules).toHaveLength(1);
            expect(cookieRules[0]).toBe('$cookie=/.+/;maxAge=60,third-party');

            appContext.configuration.settings.stealth.selfDestructThirdPartyCookies = true;
            appContext.configuration.settings.stealth.selfDestructThirdPartyCookiesTime = 0;

            service = new StealthService(appContext, filteringLog);

            cookieRules = service.getCookieRulesTexts();
            expect(cookieRules).toHaveLength(1);
            expect(cookieRules[0]).toBe('$cookie=/.+/,third-party');
        });

        it('returns third-party and first-party cookies together', () => {
            appContext.configuration.settings.stealth.selfDestructFirstPartyCookies = true;
            appContext.configuration.settings.stealth.selfDestructFirstPartyCookiesTime = 0;
            appContext.configuration.settings.stealth.selfDestructThirdPartyCookies = true;
            appContext.configuration.settings.stealth.selfDestructThirdPartyCookiesTime = 1;

            const service = new StealthService(appContext, filteringLog);

            const cookieRules = service.getCookieRulesTexts();
            expect(cookieRules).toHaveLength(2);
            expect(cookieRules.some((rule) => rule === '$cookie=/.+/;maxAge=60,third-party')).toBeTruthy();
            expect(cookieRules.some((rule) => rule === '$cookie=/.+/')).toBeTruthy();
        });
    });

    describe('Stealth service - headers', () => {
        const getContextWithHeaders = (headers: WebRequest.HttpHeaders): RequestContext => {
            return {
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
                matchingResult: new MatchingResult([], null),
                cookies: undefined,
                contentTypeHeader: undefined,
                method: 'GET',
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
            const service = new StealthService(appContext, filteringLog);

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
            const service = new StealthService(appContext, filteringLog);

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
            const service = new StealthService(appContext, filteringLog);

            expect(service.processRequestHeaders(getContextWithHeaders([{
                name: 'X-Client-Data',
                value: 'some data',
            }]))).toBe(StealthActions.BlockChromeClientData);
        });

        it('checks send-do-not-track', () => {
            appContext.configuration.settings.stealth.sendDoNotTrack = true;
            const service = new StealthService(appContext, filteringLog);

            const context = getContextWithHeaders([]);

            expect(service.processRequestHeaders(context)).toBe(StealthActions.SendDoNotTrack);
            expect(context.requestHeaders).toHaveLength(2);
            expect(context.requestHeaders![0].name).toBe('DNT');
            expect(context.requestHeaders![0].value).toBe('1');
            expect(context.requestHeaders![1].name).toBe('Sec-GPC');
            expect(context.requestHeaders![1].value).toBe('1');
        });

        it('checks global GPC value in the navigator', () => {
            appContext.configuration.settings.stealth.sendDoNotTrack = true;
            const service = new StealthService(appContext, filteringLog);

            // Here we check that the function is written correctly in the string,
            // to avoid changing its form to a lambda function, for example.
            const funcTxt = service.getSetDomSignalScript();
            expect(funcTxt).toStrictEqual(`;(function setDomSignal() {
    try {
      if ('globalPrivacyControl' in Navigator.prototype) {
        return;
      }
      Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', {
        get: () => true,
        configurable: true,
        enumerable: true
      });
    } catch (ex) {
      // Ignore
    }
  })();`);
        });
    });
});
