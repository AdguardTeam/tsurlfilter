import { DomainUtils } from '../../src/utils/domain';

describe('Domain utils', () => {
    test('isValidDomainOrHostname should return true for valid domains', () => {
        // Wildcard-only
        expect(DomainUtils.isValidDomainOrHostname('*')).toBeTruthy();

        // Regular domains
        expect(DomainUtils.isValidDomainOrHostname('example.com')).toBeTruthy();
        expect(DomainUtils.isValidDomainOrHostname('something.example.com')).toBeTruthy();
        expect(DomainUtils.isValidDomainOrHostname('anything.something.example.com')).toBeTruthy();

        // Wildcard TLD
        expect(DomainUtils.isValidDomainOrHostname('example.*')).toBeTruthy();
        expect(DomainUtils.isValidDomainOrHostname('something.example.*')).toBeTruthy();
        expect(DomainUtils.isValidDomainOrHostname('anything.something.example.*')).toBeTruthy();

        // Wildcard subdomain
        expect(DomainUtils.isValidDomainOrHostname('*.example.com')).toBeTruthy();
        expect(DomainUtils.isValidDomainOrHostname('*.something.example.com')).toBeTruthy();

        // Wildcard subdomain and TLD
        expect(DomainUtils.isValidDomainOrHostname('*.example.*')).toBeTruthy();
        expect(DomainUtils.isValidDomainOrHostname('*.something.example.*')).toBeTruthy();

        // IP address
        expect(DomainUtils.isValidDomainOrHostname('127.0.0.1')).toBeTruthy();

        // IDN
        expect(DomainUtils.isValidDomainOrHostname('한글코딩.org')).toBeTruthy();
    });

    test('isValidDomainOrHostname should return false for invalid domains', () => {
        // Missed TLD
        expect(DomainUtils.isValidDomainOrHostname('example.')).toBeFalsy();

        // Dot only
        expect(DomainUtils.isValidDomainOrHostname('.')).toBeFalsy();
        expect(DomainUtils.isValidDomainOrHostname('...')).toBeFalsy();

        // Invalid characters
        expect(DomainUtils.isValidDomainOrHostname('AA BB')).toBeFalsy();
        expect(DomainUtils.isValidDomainOrHostname('AA BB CC')).toBeFalsy();

        // Another invalid characters
        expect(DomainUtils.isValidDomainOrHostname('a^b')).toBeFalsy();
        expect(DomainUtils.isValidDomainOrHostname('a//b')).toBeFalsy();
    });
});
