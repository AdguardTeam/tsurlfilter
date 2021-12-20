/* eslint-disable max-len */
import { WebRequest } from 'webextension-polyfill';
import { StealthActions, StealthConfig, StealthService } from '../../../src/background/services/stealth-service';
import { RequestType } from '@adguard/tsurlfilter';
import HttpHeaders = WebRequest.HttpHeaders;

describe('Stealth service - cookies', () => {
    let config: StealthConfig;

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

    it('returns first-party cookies', () => {
        config.selfDestructFirstPartyCookies = true;
        config.selfDestructFirstPartyCookiesTime = 1;

        const service = new StealthService(config);

        const cookieRulesTexts = service.getCookieRulesTexts();
        expect(cookieRulesTexts).toHaveLength(1);
        expect(cookieRulesTexts[0]).toBe('$cookie=/.+/;maxAge=60');
    });

    it('returns third-party cookies', () => {
        config.selfDestructFirstPartyCookies = false;
        config.selfDestructFirstPartyCookiesTime = 0;

        config.selfDestructThirdPartyCookies = true;
        config.selfDestructThirdPartyCookiesTime = 1;

        let service = new StealthService(config);

        let cookieRules = service.getCookieRulesTexts();
        expect(cookieRules).toHaveLength(1);
        expect(cookieRules[0]).toBe('$cookie=/.+/;maxAge=60,third-party');

        config.selfDestructThirdPartyCookies = true;
        config.selfDestructThirdPartyCookiesTime = 0;

        service = new StealthService(config);

        cookieRules = service.getCookieRulesTexts();
        expect(cookieRules).toHaveLength(1);
        expect(cookieRules[0]).toBe('$cookie=/.+/,third-party');
    });

    it('returns third-party and first-party cookies together', () => {
        config.selfDestructFirstPartyCookies = true;
        config.selfDestructFirstPartyCookiesTime = 0;
        config.selfDestructThirdPartyCookies = true;
        config.selfDestructThirdPartyCookiesTime = 1;

        const service = new StealthService(config);

        const cookieRules = service.getCookieRulesTexts();
        expect(cookieRules).toHaveLength(2);
        expect(cookieRules.some((rule) => rule === '$cookie=/.+/;maxAge=60,third-party')).toBeTruthy();
        expect(cookieRules.some((rule) => rule === '$cookie=/.+/')).toBeTruthy();
    });
});

describe('Stealth service - headers', () => {
    const url = 'https://example.org';
    let config: StealthConfig;

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
        const service = new StealthService(config);

        expect(service.processRequestHeaders(url, RequestType.Document, [
            {
                name: 'Referer',
                value: 'http://example.org',
            },
        ])).toBe(0);
        expect(service.processRequestHeaders(url, RequestType.Document, [
            {
                name: 'Referer',
                value: 'http://other.org',
            },
        ])).toBe(StealthActions.HIDE_REFERRER);
    });

    it('checks hide search query', () => {
        config.hideSearchQueries = true;
        const service = new StealthService(config);

        expect(service.processRequestHeaders(url, RequestType.Document, [
            {
                name: 'Referer',
                value: 'http://other.org',
            },
        ])).toBe(0);

        expect(service.processRequestHeaders(url, RequestType.Document, [
            {
                name: 'Referer',
                value: 'http://www.google.com',
            },
        ])).toBe(StealthActions.HIDE_SEARCH_QUERIES);
    });

    it('checks block chrome client data', () => {
        config.blockChromeClientData = true;
        const service = new StealthService(config);

        expect(service.processRequestHeaders(url, RequestType.Document, [
            {
                name: 'X-Client-Data',
                value: 'some data',
            },
        ])).toBe(StealthActions.BLOCK_CHROME_CLIENT_DATA);
    });

    it('checks send-do-not-track', () => {
        config.sendDoNotTrack = true;
        const service = new StealthService(config);

        const requestHeaders = [] as HttpHeaders;

        expect(service.processRequestHeaders(url, RequestType.Document, requestHeaders)).toBe(StealthActions.SEND_DO_NOT_TRACK);
        expect(requestHeaders).toHaveLength(2);
        expect(requestHeaders[0].name).toBe('DNT');
        expect(requestHeaders[1].name).toBe('Sec-GPC');
    });
});
