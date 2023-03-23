import { WebRequest } from 'webextension-polyfill';
import { MatchingResult, RequestType } from '@adguard/tsurlfilter';

import { ContentType, StealthConfig } from '@lib/common';
import { RequestContext, RequestContextState } from '@lib/mv2';
import { StealthActions, StealthService } from '@lib/mv2/background/services/stealth-service';

import { MockFilteringLog } from '../../../common/mocks/mock-filtering-log';

describe('Stealth service', () => {
    let config: StealthConfig;

    const filteringLog = new MockFilteringLog();

    beforeEach(() => {
        config = {
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

    describe('Cookies', () => {
        it('returns first-party cookies', () => {
            config.selfDestructFirstPartyCookies = true;
            config.selfDestructFirstPartyCookiesTime = 1;

            const service = new StealthService(config, filteringLog);

            const cookieRulesTexts = service.getCookieRulesTexts();
            expect(cookieRulesTexts).toHaveLength(1);
            expect(cookieRulesTexts[0]).toBe('$cookie=/.+/;maxAge=60');
        });

        it('returns third-party cookies', () => {
            config.selfDestructFirstPartyCookies = false;
            config.selfDestructFirstPartyCookiesTime = 0;

            config.selfDestructThirdPartyCookies = true;
            config.selfDestructThirdPartyCookiesTime = 1;

            let service = new StealthService(config, filteringLog);

            let cookieRules = service.getCookieRulesTexts();
            expect(cookieRules).toHaveLength(1);
            expect(cookieRules[0]).toBe('$cookie=/.+/;maxAge=60,third-party');

            config.selfDestructThirdPartyCookies = true;
            config.selfDestructThirdPartyCookiesTime = 0;

            service = new StealthService(config, filteringLog);

            cookieRules = service.getCookieRulesTexts();
            expect(cookieRules).toHaveLength(1);
            expect(cookieRules[0]).toBe('$cookie=/.+/,third-party');
        });

        it('returns third-party and first-party cookies together', () => {
            config.selfDestructFirstPartyCookies = true;
            config.selfDestructFirstPartyCookiesTime = 0;
            config.selfDestructThirdPartyCookies = true;
            config.selfDestructThirdPartyCookiesTime = 1;

            const service = new StealthService(config, filteringLog);

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
            config = {
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
            config.hideReferrer = true;
            const service = new StealthService(config, filteringLog);

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
            config.hideSearchQueries = true;
            const service = new StealthService(config, filteringLog);

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
            config.blockChromeClientData = true;
            const service = new StealthService(config, filteringLog);

            expect(service.processRequestHeaders(getContextWithHeaders([{
                name: 'X-Client-Data',
                value: 'some data',
            }]))).toBe(StealthActions.BlockChromeClientData);
        });

        it('checks send-do-not-track', () => {
            config.sendDoNotTrack = true;
            const service = new StealthService(config, filteringLog);

            const context = getContextWithHeaders([]);

            expect(service.processRequestHeaders(context)).toBe(StealthActions.SendDoNotTrack);
            expect(context.requestHeaders).toHaveLength(2);
            expect(context.requestHeaders![0].name).toBe('DNT');
            expect(context.requestHeaders![0].value).toBe('1');
            expect(context.requestHeaders![1].name).toBe('Sec-GPC');
            expect(context.requestHeaders![1].value).toBe('1');
        });

        it('checks global GPC value in the navigator', () => {
            config.sendDoNotTrack = true;
            const service = new StealthService(config, filteringLog);

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
