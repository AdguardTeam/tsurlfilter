import { describe, expect, it } from 'vitest';

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

    it('handles urls', () => {
        let f = () => new Request('', 'example.com', RequestType.Other);
        expect(f).toThrow(TypeError);
        expect(f).toThrow(/Invalid request url:/);

        // @ts-ignore
        f = () => new Request(undefined, 'example.com', RequestType.Other);
        expect(f).toThrow(TypeError);
        expect(f).toThrow(/Invalid request url:/);

        f = () => new Request(
            'view-source:resource://devtools/shared/ThreadSafeDevToolsUtils.js',
            'example.com',
            RequestType.Document,
        );
        expect(f).toThrow(TypeError);
        expect(f).toThrow(/Invalid request url:/);
    });

    it('parses IPv6 addresses correctly using URL API fallback', () => {
        // tldts fails to parse [::] (unspecified IPv6 address), but URL API handles it
        const request1 = new Request('http://[::]:8000/', null, RequestType.Other);
        expect(request1.hostname).toEqual('[::]');
        expect(request1.url).toEqual('http://[::]:8000/');

        // Without port
        const request2 = new Request('http://[::]/', null, RequestType.Other);
        expect(request2.hostname).toEqual('[::]');
        expect(request2.url).toEqual('http://[::]/');

        // IPv6 loopback - tldts handles this correctly
        const request3 = new Request('http://[::1]:8000/', null, RequestType.Other);
        expect(request3.hostname).toEqual('::1');
        expect(request3.url).toEqual('http://[::1]:8000/');

        // Full IPv6 address
        const request4 = new Request('http://[2001:db8::1]:8080/', null, RequestType.Other);
        expect(request4.hostname).toEqual('2001:db8::1');
        expect(request4.url).toEqual('http://[2001:db8::1]:8080/');
    });

    it('parses IPv6 sourceUrl correctly using URL API fallback', () => {
        // Test that sourceUrl fallback also works for IPv6
        // Note: thirdParty detection may be null for edge-case IPv6 addresses
        // that tldts doesn't recognize as IPs (like [::])
        const request1 = new Request(
            'http://example.org/',
            'http://[::]:8000/',
            RequestType.Other,
        );
        expect(request1.hostname).toEqual('example.org');
        expect(request1.sourceHostname).toEqual('[::]');
        expect(request1.sourceUrl).toEqual('http://[::]:8000/');
        // thirdParty is null because tldts doesn't set isIp for [::]
        expect(request1.thirdParty).toBeNull();

        // IPv6 loopback is recognized by tldts as IP, so third-party detection works
        const request2 = new Request(
            'http://[::1]:8000/',
            'http://[::1]:8000/',
            RequestType.Other,
        );
        expect(request2.hostname).toEqual('::1');
        expect(request2.sourceHostname).toEqual('::1');
        expect(request2.thirdParty).toEqual(false);

        // Different IPv6 addresses - both recognized as IPs
        const request3 = new Request(
            'http://[::1]:8000/',
            'http://[2001:db8::1]:8000/',
            RequestType.Other,
        );
        expect(request3.hostname).toEqual('::1');
        expect(request3.sourceHostname).toEqual('2001:db8::1');
        expect(request3.thirdParty).toEqual(true);
    });
});
