import {
    afterAll,
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { DomainModifier } from '../../src/modifiers/domain-modifier';
import { loggerMocks } from '../setup';

describe('Domain modifier', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    afterAll(() => {
        vi.resetAllMocks();
    });

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
        it.each(domainsListCases)('%s', ({ actual, expected }) => {
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
        it.each(modifierCases)('%s', ({ actual, expected }) => {
            const domainModifier = new DomainModifier(actual, MODIFIER_LIST_SEPARATOR);
            expect(domainModifier.permittedDomains).toStrictEqual(expected.permitted);
            expect(domainModifier.restrictedDomains).toStrictEqual(expected.restricted);
        });
    });

    describe('constructor and invalid domains', () => {
        const COMMA_SEPARATOR = ',';
        const NO_DOMAINS_ERROR = 'At least one domain must be specified';
        const EMPTY_DOMAIN_ERROR = 'Empty value specified in the list';
        const STARTS_WITH_SEPARATOR_ERROR = 'Value list cannot start with a separator';
        const ENDS_WITH_SEPARATOR_ERROR = 'Value list cannot end with a separator';
        const HAS_INVALID_WILDCARD = 'Wildcards are only supported for top-level domains:';
        const SPACE_AFTER_EXCEPTION_ERROR = 'Exception marker cannot be followed by whitespace';
        const invalidCases = [
            {
                actual: '',
                error: NO_DOMAINS_ERROR,
            },
            {
                actual: ' ',
                error: NO_DOMAINS_ERROR,
            },
            {
                actual: '~',
                error: EMPTY_DOMAIN_ERROR,
            },
            {
                actual: '~  ,',
                error: ENDS_WITH_SEPARATOR_ERROR,
            },
            {
                actual: '~ example.com',
                error: SPACE_AFTER_EXCEPTION_ERROR,
            },
            {
                actual: 'example.com,',
                error: ENDS_WITH_SEPARATOR_ERROR,
            },
            {
                actual: 'example.com, ',
                error: ENDS_WITH_SEPARATOR_ERROR,
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
        it.each(invalidCases)('%s', ({ actual, error }) => {
            expect(() => {
                new DomainModifier(actual, COMMA_SEPARATOR);
            }).toThrow(error);
        });
    });

    // AG-57204: escaped [ ] , \ must resolve in regexp $domain values
    // (https://github.com/AdguardTeam/tsurlfilter/issues/190)
    describe('unescaping of escaped regex special characters in regexp domains', () => {
        const PIPE_SEPARATOR = '|';
        const COMMA_SEPARATOR = ',';

        it('works with escaped brackets in a permitted regexp domain', () => {
            const modifier = new DomainModifier(String.raw`/mingky\[0-9\]+\.net/`, PIPE_SEPARATOR);

            expect(modifier.permittedDomains).toStrictEqual([String.raw`/mingky[0-9]+\.net/`]);
            expect(modifier.matchDomain('mingky03.net')).toBeTruthy();
            expect(modifier.matchDomain('mingky[0-9].net')).toBeFalsy();
            expect(modifier.matchDomain('mingkyx.net')).toBeFalsy();
        });

        it('works with escaped brackets in a restricted regexp domain', () => {
            const modifier = new DomainModifier(String.raw`~/bad\[0-9\]\.com/`, PIPE_SEPARATOR);

            expect(modifier.restrictedDomains).toStrictEqual([String.raw`/bad[0-9]\.com/`]);
            expect(modifier.matchDomain('bad5.com')).toBeFalsy();
            expect(modifier.matchDomain('good.com')).toBeTruthy();
        });

        it('works with escaped brackets in a mixed comma-separated domain list', () => {
            const modifier = new DomainModifier(String.raw`example.com,/foo\[bar\]\.org/`, COMMA_SEPARATOR);

            expect(modifier.permittedDomains).toStrictEqual(['example.com', String.raw`/foo[bar]\.org/`]);
            expect(modifier.matchDomain('fooa.org')).toBeTruthy();
            expect(modifier.matchDomain('example.com')).toBeTruthy();
        });

        it('works with escaped backslashes in a regexp domain', () => {
            const modifier = new DomainModifier(String.raw`/(\\d+)?dizipal(\\d+)?\.com/`, PIPE_SEPARATOR);

            expect(modifier.permittedDomains).toStrictEqual([String.raw`/(\d+)?dizipal(\d+)?\.com/`]);
            expect(modifier.matchDomain('dizipal123.com')).toBeTruthy();
            expect(modifier.matchDomain('dizipalX.com')).toBeFalsy();
        });

        it('works with an escaped comma in a regexp domain', () => {
            const modifier = new DomainModifier(String.raw`/a\,b\.test/`, PIPE_SEPARATOR);

            expect(modifier.permittedDomains).toStrictEqual([String.raw`/a,b\.test/`]);
            expect(modifier.matchDomain('a,b.test')).toBeTruthy();
        });

        it('works with case-sensitive regexp classes kept intact', () => {
            const modifier = new DomainModifier(String.raw`/foo\D\.bar/`, PIPE_SEPARATOR);

            expect(modifier.permittedDomains).toStrictEqual([String.raw`/foo\D\.bar/`]);
            expect(modifier.matchDomain('foox.bar')).toBeTruthy();
            expect(modifier.matchDomain('foo1.bar')).toBeFalsy();
        });

        it('leaves plain, wildcard and raw-regexp values untouched', () => {
            // A plain string on purpose: `\\.` is a single backslash at runtime,
            // i.e. this is the raw (unescaped-brackets) regexp form
            const modifier = new DomainModifier('example.com|example.*|/mingky[0-9]+\\.net/', PIPE_SEPARATOR);

            expect(modifier.permittedDomains)
                .toStrictEqual(['example.com', 'example.*', String.raw`/mingky[0-9]+\.net/`]);
            expect(modifier.matchDomain('mingky03.net')).toBeTruthy();
        });

        it('throws for a regexp domain value that does not compile after unescaping', () => {
            expect(() => new DomainModifier(String.raw`/foo\[bar/`, PIPE_SEPARATOR))
                .toThrow('Invalid regular expression as domain pattern');
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

        it('logs debug message on invalid regexp pattern', () => {
            // eslint-disable-next-line max-len
            const msg = '[tsurl.DomainModifier.isDomainOrSubdomainOfAny]: invalid regular expression as domain pattern: "/example[org/"';

            isDomainOrSubdomainOfAny('example.org', ['/example[org/']);

            expect(loggerMocks.error).toHaveBeenCalledTimes(1);
            expect(loggerMocks.error).toHaveBeenCalledWith(msg);
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
