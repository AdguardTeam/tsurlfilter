import { Request } from '../src/request';
import { RequestType } from '../src/request-type';

describe('Creating request', () => {
    it('works if simple request is parsed properly', () => {
        const request = new Request('http://example.org/', null, RequestType.Other);
        expect(request.url).toEqual('http://example.org/');
        expect(request.hostname).toEqual('example.org');
        expect(request.domain).toEqual('example.org');
        expect(request.sourceUrl).toBeNull();
        expect(request.sourceHostname).toBeNull();
        expect(request.sourceDomain).toBeNull();
        expect(request.requestType).toEqual(RequestType.Other);
        expect(request.thirdParty).toBeNull();
    });

    it('works if source URL is parsed properly', () => {
        const request = new Request('http://example.org/', 'http://sub.example.org', RequestType.Other);
        expect(request.url).toEqual('http://example.org/');
        expect(request.hostname).toEqual('example.org');
        expect(request.domain).toEqual('example.org');
        expect(request.sourceUrl).toEqual('http://sub.example.org');
        expect(request.sourceHostname).toEqual('sub.example.org');
        expect(request.sourceDomain).toEqual('example.org');
        expect(request.requestType).toEqual(RequestType.Other);
        expect(request.thirdParty).toEqual(false);
    });

    it('works if eTLD is parsed properly', () => {
        const request = new Request('http://example.org.uk/', 'http://sub.example.org.uk', RequestType.Other);
        expect(request.url).toEqual('http://example.org.uk/');
        expect(request.hostname).toEqual('example.org.uk');
        expect(request.domain).toEqual('example.org.uk');
        expect(request.sourceUrl).toEqual('http://sub.example.org.uk');
        expect(request.sourceHostname).toEqual('sub.example.org.uk');
        expect(request.sourceDomain).toEqual('example.org.uk');
        expect(request.requestType).toEqual(RequestType.Other);
        expect(request.thirdParty).toEqual(false);
    });

    it('works if third-party is detected properly', () => {
        const request = new Request('http://example.org.uk/', 'http://sub.example.org', RequestType.Other);
        expect(request.url).toEqual('http://example.org.uk/');
        expect(request.hostname).toEqual('example.org.uk');
        expect(request.domain).toEqual('example.org.uk');
        expect(request.sourceUrl).toEqual('http://sub.example.org');
        expect(request.sourceHostname).toEqual('sub.example.org');
        expect(request.sourceDomain).toEqual('example.org');
        expect(request.requestType).toEqual(RequestType.Other);
        expect(request.thirdParty).toEqual(true);
    });

    it('detects third-party properly for IP domains', () => {
        const request = new Request('https://example.org', 'https://1.2.3.4/', RequestType.Other);
        expect(request.sourceHostname).toEqual('1.2.3.4');
        expect(request.thirdParty).toEqual(true);

        const request2 = new Request('https://1.2.3.4/', 'https://1.2.3.4/', RequestType.Other);
        expect(request2.thirdParty).toEqual(false);
    });

    it('parses subdomains', () => {
        const request = new Request('http://sub.sub.example.org/part', 'http://sub.example.org', RequestType.Other);
        expect(request.subdomains.sort()).toEqual([
            'sub.sub.example.org',
            'sub.example.org',
            'example.org',
            'org'].sort());
        expect(request.sourceSubdomains.sort()).toEqual(['sub.example.org', 'example.org', 'org'].sort());
    });

    it('parses subdomains with complex tld', () => {
        const request = new Request('http://sub.sub.example.org.uk/part', 'http://sub.example.org', RequestType.Other);
        expect(request.subdomains.sort())
            .toEqual(['sub.sub.example.org.uk', 'sub.example.org.uk', 'example.org.uk', 'org.uk', 'uk'].sort());
        expect(request.sourceSubdomains.sort())
            .toEqual(['sub.example.org', 'example.org', 'org'].sort());
    });

    it('parses domains with complex public suffixes', () => {
        // eslint-disable-next-line max-len
        const request = new Request('https://www.city.toyota.aichi.jp/part', 'https://www.city.toyota.aichi.jp/', RequestType.Other);
        expect(request.subdomains.sort())
            .toEqual(['www.city.toyota.aichi.jp', 'city.toyota.aichi.jp', 'toyota.aichi.jp', 'aichi.jp', 'jp'].sort());
    });

    it('parses subdomains for localhost', () => {
        const request = new Request('http://localhost', 'http://localhost.test', RequestType.Other);
        expect(request.subdomains.sort()).toEqual(['localhost'].sort());
        expect(request.sourceSubdomains.sort()).toEqual(['localhost.test', 'test'].sort());
    });

    it('handles empty hostname', () => {
        let f = () => new Request('', 'example.com', RequestType.Other);
        expect(f).not.toThrow();

        // @ts-ignore
        f = () => new Request(undefined, 'example.com', RequestType.Other);
        expect(f).toThrow(TypeError);
        expect(f).toThrow(/Invalid request url:/);
    });
});
