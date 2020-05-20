/* eslint-disable max-len */
import { StealthConfig, StealthService } from '../../src/stealth/stealth-service';
import { Request, RequestType } from '../../src';

describe('Stealth service - tracking parameters', () => {
    it('checks tracking parameters', () => {
        const config: StealthConfig = {
            stripTrackingParameters: true,
            trackingParameters: 'utm_source,utm_medium,utm_term,utm_campaign,utm_content,utm_name,utm_cid,utm_reader,utm_viz_id,utm_pubreferrer,utm_swu,utm_referrer,utm_social,utm_social-type,utm_place,utm_userid,utm_channel,fb_action_ids,fb_action_types,fb_ref,fb_source',
            selfDestructThirdPartyCookies: false,
            selfDestructThirdPartyCookiesTime: 0,
            selfDestructFirstPartyCookies: false,
            selfDestructFirstPartyCookiesTime: 0,
        };

        const service = new StealthService(config);

        let request = new Request('https://example.org', '', RequestType.Document);
        expect(service.removeTrackersFromUrl(request)).toBeNull();

        request = new Request('https://example.org?utm_source=clean&an_other=keep&utm_name=clean', '', RequestType.Document);
        expect(service.removeTrackersFromUrl(request)).toBe('https://example.org?an_other=keep');

        request = new Request('https://example.org?utm_source=clean&an_other=keep&utm_name=clean', '', RequestType.Image);
        expect(service.removeTrackersFromUrl(request)).toBeNull();
    });

    it('checks tracking parameters - disabled', () => {
        const config: StealthConfig = {
            stripTrackingParameters: false,
            trackingParameters: 'utm_source,utm_medium,utm_term,utm_campaign,utm_content,utm_name,utm_cid,utm_reader,utm_viz_id,utm_pubreferrer,utm_swu,utm_referrer,utm_social,utm_social-type,utm_place,utm_userid,utm_channel,fb_action_ids,fb_action_types,fb_ref,fb_source',
            selfDestructThirdPartyCookies: false,
            selfDestructThirdPartyCookiesTime: 0,
            selfDestructFirstPartyCookies: false,
            selfDestructFirstPartyCookiesTime: 0,
        };

        const service = new StealthService(config);

        let request = new Request('https://example.org', '', RequestType.Document);
        expect(service.removeTrackersFromUrl(request)).toBeNull();

        request = new Request('https://example.org?utm_source=clean&an_other=keep&utm_name=clean', '', RequestType.Document);
        expect(service.removeTrackersFromUrl(request)).toBeNull();

        request = new Request('https://example.org?utm_source=clean&an_other=keep&utm_name=clean', '', RequestType.Image);
        expect(service.removeTrackersFromUrl(request)).toBeNull();
    });

    it('checks tracking parameters - no parameters specified', () => {
        const config: StealthConfig = {
            stripTrackingParameters: true,
            trackingParameters: '',
            selfDestructThirdPartyCookies: false,
            selfDestructThirdPartyCookiesTime: 0,
            selfDestructFirstPartyCookies: false,
            selfDestructFirstPartyCookiesTime: 0,
        };

        const service = new StealthService(config);

        let request = new Request('https://example.org', '', RequestType.Document);
        expect(service.removeTrackersFromUrl(request)).toBeNull();

        request = new Request('https://example.org?utm_source=clean&an_other=keep&utm_name=clean', '', RequestType.Document);
        expect(service.removeTrackersFromUrl(request)).toBeNull();

        request = new Request('https://example.org?utm_source=clean&an_other=keep&utm_name=clean', '', RequestType.Image);
        expect(service.removeTrackersFromUrl(request)).toBeNull();
    });
});

describe('Stealth service - cookies', () => {
    it('checks first-party cookies', () => {
        const config: StealthConfig = {
            stripTrackingParameters: false,
            trackingParameters: '',
            selfDestructThirdPartyCookies: false,
            selfDestructThirdPartyCookiesTime: 1,
            selfDestructFirstPartyCookies: true,
            selfDestructFirstPartyCookiesTime: 1,
        };

        const service = new StealthService(config);

        let request = new Request('https://example.org', '', RequestType.Document);
        let cookieRules = service.getCookieRules(request);
        expect(cookieRules).toHaveLength(1);
        expect(cookieRules[0].getText()).toBe('$cookie=/.+/;maxAge=60');

        request = new Request('https://example.org', '', RequestType.Image);
        cookieRules = service.getCookieRules(request);
        expect(cookieRules).toHaveLength(1);
        expect(cookieRules[0].getText()).toBe('$cookie=/.+/;maxAge=60');
    });

    it('checks third-party cookies', () => {
        const config: StealthConfig = {
            stripTrackingParameters: false,
            trackingParameters: '',
            selfDestructThirdPartyCookies: true,
            selfDestructThirdPartyCookiesTime: 0,
            selfDestructFirstPartyCookies: false,
            selfDestructFirstPartyCookiesTime: 1,
        };

        const service = new StealthService(config);

        let request = new Request('https://example.org', 'https://source.com', RequestType.Subdocument);
        let cookieRules = service.getCookieRules(request);
        expect(cookieRules).toHaveLength(1);
        expect(cookieRules[0].getText()).toBe('$cookie=/.+/');

        request = new Request('https://example.org', 'https://source.com', RequestType.Document);
        cookieRules = service.getCookieRules(request);
        expect(cookieRules).toHaveLength(0);

        request = new Request('https://example.org', '', RequestType.Subdocument);
        cookieRules = service.getCookieRules(request);
        expect(cookieRules).toHaveLength(0);
    });
});
