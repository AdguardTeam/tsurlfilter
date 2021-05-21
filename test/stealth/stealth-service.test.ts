/* eslint-disable max-len */
import { StealthActions, StealthConfig, StealthService } from '../../src/stealth/stealth-service';
import { RequestType } from '../../src/request-type';

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
        };
    });

    it('checks hide referrer', () => {
        config.hideReferrer = true;
        const service = new StealthService(config);

        expect(service.processRequestHeaders(url, RequestType.Document, [
            {
                name: 'Referrer',
                value: 'http://example.org',
            },
        ])).toBe(0);
        expect(service.processRequestHeaders(url, RequestType.Document, [
            {
                name: 'Referrer',
                value: 'http://other.org',
            },
        ])).toBe(StealthActions.HIDE_REFERRER);
    });

    it('checks hide search query', () => {
        config.hideSearchQueries = true;
        const service = new StealthService(config);

        expect(service.processRequestHeaders(url, RequestType.Document, [
            {
                name: 'Referrer',
                value: 'http://other.org',
            },
        ])).toBe(0);

        expect(service.processRequestHeaders(url, RequestType.Document, [
            {
                name: 'Referrer',
                value: 'http://www.google.com',
            },
        ])).toBe(StealthActions.HIDE_SEARCH_QUERIES);
    });

    it('checks hide search query', () => {
        config.blockChromeClientData = true;
        const service = new StealthService(config);

        expect(service.processRequestHeaders(url, RequestType.Document, [
            {
                name: 'X-Client-Data',
                value: 'some data',
            },
        ])).toBe(StealthActions.BLOCK_CHROME_CLIENT_DATA);
    });

    it('checks hide search query', () => {
        config.sendDoNotTrack = true;
        const service = new StealthService(config);

        expect(service.processRequestHeaders(url, RequestType.Document, [])).toBe(StealthActions.SEND_DO_NOT_TRACK);
    });
});
