import { DomainModifier } from '../../src/modifiers/domain-modifier';

describe('Domain modifier', () => {
    describe('constructor and valid domains string', () => {
        const COMMA_SEPARATOR = ',';
        const domainsListCases = [
            {
                actual: 'example.com',
                expected: {
                    permitted: ['example.com'],
                    restricted: null,
                },
            },
            {
                actual: 'example.*',
                expected: {
                    permitted: ['example.*'],
                    restricted: null,
                },
            },
            {
                actual: 'example.com,example.org',
                expected: {
                    permitted: ['example.com', 'example.org'],
                    restricted: null,
                },
            },
            {
                actual: '~example.com,~example.org',
                expected: {
                    permitted: null,
                    restricted: ['example.com', 'example.org'],
                },
            },
            {
                actual: 'example.*,domain.com',
                expected: {
                    permitted: ['example.*', 'domain.com'],
                    restricted: null,
                },
            },
            {
                actual: 'example.*,~example.com',
                expected: {
                    permitted: ['example.*'],
                    restricted: ['example.com'],
                },
            },
            {
                actual: 'example.org,~example.com,example.*,/io/|~/net/',
                expected: {
                    permitted: ['example.org', 'example.*', '/io/|~/net/'],
                    restricted: ['example.com'],
                },
            },
        ];
        test.each(domainsListCases)('%s', ({ actual, expected }) => {
            const domainModifier = new DomainModifier(actual, COMMA_SEPARATOR);
            expect(domainModifier.permittedDomains).toStrictEqual(expected.permitted);
            expect(domainModifier.restrictedDomains).toStrictEqual(expected.restricted);
        });

        const MODIFIER_LIST_SEPARATOR = '|';
        const modifierCases = [
            {
                actual: 'example.com',
                expected: {
                    permitted: ['example.com'],
                    restricted: null,
                },
            },
            {
                actual: 'EXAMPLE.com',
                expected: {
                    permitted: ['example.com'],
                    restricted: null,
                },
            },
            {
                // check
                actual: 'ÖRNEK.com',
                expected: {
                    permitted: ['örnek.com'],
                    restricted: null,
                },
            },
            {
                actual: 'example.com|example.org',
                expected: {
                    permitted: ['example.com', 'example.org'],
                    restricted: null,
                },
            },
            {
                actual: 'example.com|example.org',
                expected: {
                    permitted: ['example.com', 'example.org'],
                    restricted: null,
                },
            },
            {
                actual: '~example.com|~example.org',
                expected: {
                    permitted: null,
                    restricted: ['example.com', 'example.org'],
                },
            },
            {
                actual: 'example.*|domain.com',
                expected: {
                    permitted: ['example.*', 'domain.com'],
                    restricted: null,
                },
            },
            {
                actual: 'example.*|~example.com',
                expected: {
                    permitted: ['example.*'],
                    restricted: ['example.com'],
                },
            },
        ];
        test.each(modifierCases)('%s', ({ actual, expected }) => {
            const domainModifier = new DomainModifier(actual, MODIFIER_LIST_SEPARATOR);
            expect(domainModifier.permittedDomains).toStrictEqual(expected.permitted);
            expect(domainModifier.restrictedDomains).toStrictEqual(expected.restricted);
        });
    });

    describe('constructor and invalid domains', () => {
        const COMMA_SEPARATOR = ',';
        const EMPTY_DOMAIN_ERROR = 'Empty domain specified in';
        const STARTS_WITH_SEPARATOR_ERROR = `Modifier $domain cannot start with "${COMMA_SEPARATOR}"`;
        const HAS_INVALID_WILDCARD = 'Wildcards are only supported for top-level domains:';
        const invalidCases = [
            {
                actual: '',
                error: 'Modifier $domain cannot be empty',
            },
            {
                actual: ' ',
                error: EMPTY_DOMAIN_ERROR,
            },
            {
                actual: '~',
                error: EMPTY_DOMAIN_ERROR,
            },
            {
                actual: '~  ,',
                error: EMPTY_DOMAIN_ERROR,
            },
            {
                actual: 'example.com,',
                error: EMPTY_DOMAIN_ERROR,
            },
            {
                actual: 'example.com, ',
                error: EMPTY_DOMAIN_ERROR,
            },
            {
                actual: 'example.com,,example.org',
                error: EMPTY_DOMAIN_ERROR,
            },
            {
                actual: 'example.com,  ,example.org',
                error: EMPTY_DOMAIN_ERROR,
            },
            {
                actual: ',example.com',
                error: STARTS_WITH_SEPARATOR_ERROR,
            },
            {
                actual: ',',
                error: STARTS_WITH_SEPARATOR_ERROR,
            },
            {
                actual: 'example.com,*.org',
                error: HAS_INVALID_WILDCARD,
            },
        ];
        test.each(invalidCases)('%s', ({ actual, error }) => {
            expect(() => {
                new DomainModifier(actual, COMMA_SEPARATOR);
            }).toThrow(error);
        });
    });

    describe('DomainModifier.isDomainOrSubdomainOfAny', () => {
        const { isDomainOrSubdomainOfAny } = DomainModifier;
        it('works in common cases', () => {
            expect(isDomainOrSubdomainOfAny('example.org', ['example.org'])).toBeTruthy();

            expect(isDomainOrSubdomainOfAny('example.com', ['example.org'])).toBeFalsy();
            expect(isDomainOrSubdomainOfAny('', ['example.org'])).toBeFalsy();
            expect(isDomainOrSubdomainOfAny('example.org', [])).toBeFalsy();
        });

        it('works in wildcard cases', () => {
            expect(isDomainOrSubdomainOfAny('example.org', ['example.*', 'test.com'])).toBeTruthy();
            expect(isDomainOrSubdomainOfAny('sub.example.org', ['example.*', 'test.com'])).toBeTruthy();
            expect(isDomainOrSubdomainOfAny(
                'example.org',
                ['one.*', 'example.*', 'test.com'],
            )).toBeTruthy();
            expect(isDomainOrSubdomainOfAny('www.chrono24.ch', ['chrono24.*'])).toBeTruthy();

            expect(isDomainOrSubdomainOfAny('example.com', ['test.*'])).toBeFalsy();
            expect(isDomainOrSubdomainOfAny('subexample.org', ['example.*'])).toBeFalsy();
            expect(isDomainOrSubdomainOfAny('example.eu.uk', ['example.*'])).toBeFalsy();
            expect(isDomainOrSubdomainOfAny('example.org', ['sub.example.*', 'test.com'])).toBeFalsy();
            expect(isDomainOrSubdomainOfAny('', ['example.*', 'test.com'])).toBeFalsy();
        });
    });

    describe('DomainModifier.isNonPlainDomain', () => {
        const { isWildcardOrRegexDomain } = DomainModifier;
        it('distinguishes plain domains from patterns', () => {
            expect(isWildcardOrRegexDomain('example.co.uk')).toBeFalsy();
            expect(isWildcardOrRegexDomain('example.*')).toBeTruthy();
            expect(isWildcardOrRegexDomain(String.raw`/another\.(org|com)/`)).toBeTruthy();
        });
    });
});
