/* eslint-disable max-len */
import { StealthActions, StealthConfig, StealthService } from '../../src/stealth/stealth-service';
import { Request, RequestType } from '../../src';

describe('Stealth service - tracking parameters', () => {
    let config: StealthConfig;

    beforeEach(() => {
        config = {
            blockChromeClientData: false,
            hideReferrer: false,
            hideSearchQueries: false,
            sendDoNotTrack: false,
            stripTrackingParameters: false,
            trackingParameters: 'utm_source,utm_medium,utm_term,utm_campaign,utm_content,utm_name,utm_cid,utm_reader,utm_viz_id,utm_pubreferrer,utm_swu,utm_referrer,utm_social,utm_social-type,utm_place,utm_userid,utm_channel,fb_action_ids,fb_action_types,fb_ref,fb_source',
            selfDestructThirdPartyCookies: false,
            selfDestructThirdPartyCookiesTime: 0,
            selfDestructFirstPartyCookies: false,
            selfDestructFirstPartyCookiesTime: 0,
        };
    });

    it('checks tracking parameters', () => {
        config.stripTrackingParameters = true;

        const service = new StealthService(config);
        expect(service.removeTrackersFromUrl('https://example.org')).toBeNull();
        expect(service.removeTrackersFromUrl('https://example.org?utm_source=clean&an_other=keep&utm_name=clean')).toBe('https://example.org?an_other=keep');
        expect(service.removeTrackersFromUrl('https://example.org?an_other=keep')).toBeNull();
    });

    it('checks tracking parameters - disabled', () => {
        const service = new StealthService(config);

        expect(service.removeTrackersFromUrl('https://example.org')).toBeNull();
        expect(service.removeTrackersFromUrl('https://example.org?utm_source=clean&an_other=keep&utm_name=clean')).toBeNull();
        expect(service.removeTrackersFromUrl('https://example.org?an_other=keep')).toBeNull();
    });

    it('checks tracking parameters - no parameters specified', () => {
        config.trackingParameters = '';
        const service = new StealthService(config);

        expect(service.removeTrackersFromUrl('https://example.org')).toBeNull();
        expect(service.removeTrackersFromUrl('https://example.org?utm_source=clean&an_other=keep&utm_name=clean')).toBeNull();
        expect(service.removeTrackersFromUrl('https://example.org?an_other=keep')).toBeNull();
    });
});

describe('Stealth service - cookies', () => {
    let config: StealthConfig;

    beforeEach(() => {
        config = {
            blockChromeClientData: false,
            hideReferrer: false,
            hideSearchQueries: false,
            sendDoNotTrack: false,
            stripTrackingParameters: false,
            trackingParameters: '',
            selfDestructThirdPartyCookies: false,
            selfDestructThirdPartyCookiesTime: 0,
            selfDestructFirstPartyCookies: false,
            selfDestructFirstPartyCookiesTime: 0,
        };
    });

    it('checks first-party cookies', () => {
        config.selfDestructFirstPartyCookies = true;
        config.selfDestructFirstPartyCookiesTime = 1;

        const service = new StealthService(config);

        let request = new Request('https://example.org', '', RequestType.Document);
        let cookieRules = service.getCookieRules(request);
        expect(cookieRules).toHaveLength(1);
        expect(cookieRules[0].getText()).toBe('$cookie=/.+/;maxAge=60');
        expect(cookieRules[0].isStealthModeRule).toBeTruthy();

        request = new Request('https://example.org', '', RequestType.Image);
        cookieRules = service.getCookieRules(request);
        expect(cookieRules).toHaveLength(1);
        expect(cookieRules[0].getText()).toBe('$cookie=/.+/;maxAge=60');
        expect(cookieRules[0].isStealthModeRule).toBeTruthy();
    });

    it('checks third-party cookies', () => {
        config.selfDestructThirdPartyCookies = true;
        config.selfDestructThirdPartyCookiesTime = 0;
        config.selfDestructFirstPartyCookies = false;
        config.selfDestructFirstPartyCookiesTime = 0;

        const service = new StealthService(config);

        let request = new Request('https://example.org', 'https://source.com', RequestType.Subdocument);
        let cookieRules = service.getCookieRules(request);
        expect(cookieRules).toHaveLength(1);
        expect(cookieRules[0].getText()).toBe('$cookie=/.+/');
        expect(cookieRules[0].isStealthModeRule).toBeTruthy();

        request = new Request('https://example.org', 'https://source.com', RequestType.Document);
        cookieRules = service.getCookieRules(request);
        expect(cookieRules).toHaveLength(0);

        request = new Request('https://example.org', '', RequestType.Subdocument);
        cookieRules = service.getCookieRules(request);
        expect(cookieRules).toHaveLength(0);
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
            stripTrackingParameters: false,
            trackingParameters: '',
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
