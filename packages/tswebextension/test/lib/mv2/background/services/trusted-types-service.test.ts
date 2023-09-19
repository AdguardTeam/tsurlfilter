import { CosmeticResult, CosmeticRule } from '@adguard/tsurlfilter';
import { RequestContext } from '@lib/mv2';
import { TrustedTypesService } from '@lib/mv2/background/services/trusted-types-service';

/**
 * Expects that header is modified as expected.
 *
 * @param name Name of the header.
 * @param actual Actual header value.
 * @param expected Expected header value.
 */
const expectModifiedCspHeader = (name: string, actual: string, expected: string): void => {
    const actualHeader = {
        name,
        value: actual,
    };
    const expectedHeader = {
        name,
        value: expected,
    };
    const modifiedHeader = TrustedTypesService.modifyCspHeader(actualHeader);
    expect(modifiedHeader).toEqual(expectedHeader);
};

/**
 * Returns CosmeticResult with one scriptlet rule which uses AGPolicy.
 *
 * @returns Cosmetic Result.
 */
const getCosmeticResult = (): CosmeticResult => {
    const cosmeticResult = new CosmeticResult();

    cosmeticResult.JS.append(
        new CosmeticRule("angular.io#%#//scriptlet('prevent-element-src-loading', 'script', 'analytics')", 1),
    );

    return cosmeticResult;
};

describe('Trusted Types service', () => {
    describe('checks if headers are modified - TrustedTypesService.onHeadersReceived', () => {
        // not changed
        test.each([
            {
                name: 'content-type',
                value: 'text/html;charset=UTF-8',
            },
            {
                name: 'Content-Security-Policy',
                value: "default-src 'self'; script-src 'self'",
            },
            {
                name: 'Content-Security-Policy',
                value: "child-src 'self'",
            },
            {
                name: 'Content-Security-Policy',
                value: "require-trusted-types-for 'script'",
            },
        ])('$header.name : $header.value', (header) => {
            const context = {
                requestId: 0,
                cosmeticResult: getCosmeticResult(),
                responseHeaders: [header],
            } as unknown as RequestContext;
            const isModified = TrustedTypesService.onHeadersReceived(context);
            expect(isModified).toBeFalsy();
        });

        // should be changed
        test.each([
            {
                name: 'Content-Security-Policy',
                value: "require-trusted-types-for 'script'; trusted-types 'none'",
            },
            {
                // header names are case-insensitive
                name: 'content-security-policy',
                value: "require-trusted-types-for 'script'; trusted-types 'none'",
            },
            {
                name: 'Content-Security-Policy',
                value: 'trusted-types one two default',
            },
            {
                name: 'Content-Security-Policy-Report-Only',
                value: "require-trusted-types-for 'script'; trusted-types example example#bundler 'allow-duplicates'; report-uri https://csp.example.com/report",
            },
        ])('$header.name : $header.value', (header) => {
            const context = {
                requestId: 0,
                cosmeticResult: getCosmeticResult(),
                responseHeaders: [header],
            } as unknown as RequestContext;
            const isModified = TrustedTypesService.onHeadersReceived(context);
            expect(isModified).toBeTruthy();
        });

        // should NOT be changed because of no CosmeticResult
        test.each([
            {
                name: 'Content-Security-Policy',
                value: 'trusted-types one two three',
            },
            {
                name: 'Content-Security-Policy-Report-Only',
                value: "require-trusted-types-for 'script'; trusted-types example example#bundler 'allow-duplicates'; report-uri https://csp.example.com/report",
            },
        ])('$header.name : $header.value', (header) => {
            const context = {
                requestId: 0,
                cosmeticResult: new CosmeticResult(),
                responseHeaders: [header],
            } as unknown as RequestContext;
            const isModified = TrustedTypesService.onHeadersReceived(context);
            expect(isModified).toBeFalsy();
        });
    });

    describe('checks how response csp header are modified - TrustedTypesService.modifyCspHeader', () => {
        const CSP_NAME = 'Content-Security-Policy';
        const CSP_REPORT_NAME = 'Content-Security-Policy-Report-Only';

        test.each([
            {
                name: CSP_NAME,
                actual: "require-trusted-types-for 'script'",
                // no changes if there is no trusted-types directive
                expected: "require-trusted-types-for 'script'",
            },
            {
                name: CSP_NAME,
                actual: "require-trusted-types-for 'script'; trusted-types",
                expected: "require-trusted-types-for 'script'; trusted-types AGPolicy 'allow-duplicates'",
            },
            {
                name: CSP_NAME,
                actual: "trusted-types 'none'",
                expected: "trusted-types AGPolicy 'allow-duplicates'",
            },
            {
                name: CSP_NAME,
                actual: 'trusted-types one',
                expected: "trusted-types one AGPolicy 'allow-duplicates'",
            },
            {
                name: CSP_NAME,
                actual: 'trusted-types one two',
                expected: "trusted-types one two AGPolicy 'allow-duplicates'",
            },
            {
                name: CSP_NAME,
                actual: 'trusted-types one two default',
                expected: "trusted-types one two default AGPolicy 'allow-duplicates'",
            },
            {
                name: CSP_NAME,
                actual: 'trusted-types one two AGPolicy',
                expected: "trusted-types one two AGPolicy 'allow-duplicates'",
            },
            {
                name: CSP_NAME,
                actual: "trusted-types one two AGPolicy 'allow-duplicates'",
                expected: "trusted-types one two AGPolicy 'allow-duplicates'",
            },
            {
                name: CSP_NAME,
                actual: "trusted-types one two 'allow-duplicates'",
                expected: "trusted-types one two 'allow-duplicates' AGPolicy",
            },
            {
                name: CSP_NAME,
                actual: "require-trusted-types-for 'script'; trusted-types example#bundler example#unsafe-bypass",
                // eslint-disable-next-line max-len
                expected: "require-trusted-types-for 'script'; trusted-types example#bundler example#unsafe-bypass AGPolicy 'allow-duplicates'",
            },
            {
                name: CSP_REPORT_NAME,
                actual: "require-trusted-types-for 'script'; trusted-types example example#bundler example#html; report-uri https://csp.example.com/report",
                expected: "require-trusted-types-for 'script'; trusted-types example example#bundler example#html AGPolicy 'allow-duplicates'; report-uri https://csp.example.com/report",
            },
            {
                name: CSP_REPORT_NAME,
                actual: "require-trusted-types-for 'script'; trusted-types example example#bundler 'allow-duplicates'; report-uri https://csp.example.com/report",
                expected: "require-trusted-types-for 'script'; trusted-types example example#bundler 'allow-duplicates' AGPolicy; report-uri https://csp.example.com/report",
            },
            // do not modify the header if it has no trusted-types directive
            {
                name: CSP_NAME,
                actual: "default-src 'self'; script-src 'self'",
                expected: "default-src 'self'; script-src 'self'",
            },
        ])('$actual', ({ name, actual, expected }) => {
            expectModifiedCspHeader(name, actual, expected);
        });
    });
});
