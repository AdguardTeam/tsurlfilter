import { CosmeticRuleSeparator } from '../../src/parser/common';
import { EMPTY, SPACE } from '../../src/utils/constants';
import { CosmeticRuleSeparatorFinderResult, CosmeticRuleSeparatorUtils } from '../../src/utils/cosmetic-rule-separator';

describe('CosmeticRuleSeparator', () => {
    describe('isException', () => {
        test.each([
            // [separator, is exception]
            [CosmeticRuleSeparator.AbpSnippet, false],
            [CosmeticRuleSeparator.AbpSnippetException, true],
            [CosmeticRuleSeparator.AdgCssInjection, false],
            [CosmeticRuleSeparator.AdgCssInjectionException, true],
            [CosmeticRuleSeparator.AdgExtendedCssInjection, false],
            [CosmeticRuleSeparator.AdgExtendedCssInjectionException, true],
            [CosmeticRuleSeparator.AdgHtmlFiltering, false],
            [CosmeticRuleSeparator.AdgHtmlFilteringException, true],
            [CosmeticRuleSeparator.AdgJsInjection, false],
            [CosmeticRuleSeparator.AdgJsInjectionException, true],
            [CosmeticRuleSeparator.ElementHiding, false],
            [CosmeticRuleSeparator.ElementHidingException, true],
            [CosmeticRuleSeparator.ExtendedElementHiding, false],
            [CosmeticRuleSeparator.ExtendedElementHidingException, true],
            [CosmeticRuleSeparator.UboHtmlFiltering, false],
            [CosmeticRuleSeparator.UboHtmlFilteringException, true],
            [CosmeticRuleSeparator.UboScriptletInjection, false],
            [CosmeticRuleSeparator.UboScriptletInjectionException, true],
        ])('%s should be %s', (separator, expected) => {
            expect(CosmeticRuleSeparatorUtils.isException(separator)).toBe(expected);
        });
    });

    describe('isExtendedCssMarker', () => {
        test.each([
            // [separator, is extended css marker]
            [CosmeticRuleSeparator.AbpSnippet, false],
            [CosmeticRuleSeparator.AbpSnippetException, false],
            [CosmeticRuleSeparator.AdgCssInjection, false],
            [CosmeticRuleSeparator.AdgCssInjectionException, false],
            [CosmeticRuleSeparator.AdgExtendedCssInjection, true],
            [CosmeticRuleSeparator.AdgExtendedCssInjectionException, true],
            [CosmeticRuleSeparator.AdgHtmlFiltering, false],
            [CosmeticRuleSeparator.AdgHtmlFilteringException, false],
            [CosmeticRuleSeparator.AdgJsInjection, false],
            [CosmeticRuleSeparator.AdgJsInjectionException, false],
            [CosmeticRuleSeparator.ElementHiding, false],
            [CosmeticRuleSeparator.ElementHidingException, false],
            [CosmeticRuleSeparator.ExtendedElementHiding, true],
            [CosmeticRuleSeparator.ExtendedElementHidingException, true],
            [CosmeticRuleSeparator.UboHtmlFiltering, false],
            [CosmeticRuleSeparator.UboHtmlFilteringException, false],
            [CosmeticRuleSeparator.UboScriptletInjection, false],
            [CosmeticRuleSeparator.UboScriptletInjectionException, false],
        ])('%s should be %s', (separator, expected) => {
            expect(CosmeticRuleSeparatorUtils.isExtendedCssMarker(separator)).toBe(expected);
        });
    });

    test('find', () => {
        // Elemhide
        expect(CosmeticRuleSeparatorUtils.find('##.ad')).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '##',
                start: 0,
                end: 2,
            },
        );

        expect(CosmeticRuleSeparatorUtils.find('example.com##.ad')).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '##',
                start: 11,
                end: 13,
            },
        );

        expect(CosmeticRuleSeparatorUtils.find('example.com#@#.ad')).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '#@#',
                start: 11,
                end: 14,
            },
        );

        expect(CosmeticRuleSeparatorUtils.find('example.com,example.org#@#.ad')).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '#@#',
                start: 23,
                end: 26,
            },
        );

        expect(CosmeticRuleSeparatorUtils.find('example.com,example.org#?##ad:contains(ad)')).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '#?#',
                start: 23,
                end: 26,
            },
        );

        expect(CosmeticRuleSeparatorUtils.find('example.com,example.org#@?##ad:contains(ad)')).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '#@?#',
                start: 23,
                end: 27,
            },
        );

        // CSS inject
        expect(
            CosmeticRuleSeparatorUtils.find('example.com,example.org#$##ad { padding-top: 0px !important }'),
        ).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '#$#',
                start: 23,
                end: 26,
            },
        );

        expect(
            CosmeticRuleSeparatorUtils.find('example.com,example.org#@$##ad { padding-top: 0px !important }'),
        ).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '#@$#',
                start: 23,
                end: 27,
            },
        );

        // CSS inject with extended CSS selectors
        expect(
            CosmeticRuleSeparatorUtils.find(
                'example.com,example.org#$?##ad:has(>script) { padding-top: 0px !important }',
            ),
        ).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '#$?#',
                start: 23,
                end: 27,
            },
        );

        expect(
            CosmeticRuleSeparatorUtils.find(
                'example.com,example.org#@$?##ad:has(>script) { padding-top: 0px !important }',
            ),
        ).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '#@$?#',
                start: 23,
                end: 28,
            },
        );

        // uBO scriptlet
        expect(
            CosmeticRuleSeparatorUtils.find('example.com,example.org##+js(scriptlet, param0, param1)'),
        ).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '##+',
                start: 23,
                end: 26,
            },
        );

        expect(
            CosmeticRuleSeparatorUtils.find('example.com,example.org#@#+js(scriptlet, param0, param1)'),
        ).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '#@#+',
                start: 23,
                end: 27,
            },
        );

        // uBO HTML
        expect(
            CosmeticRuleSeparatorUtils.find('example.com,example.org##^script:has-text(advert)'),
        ).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '##^',
                start: 23,
                end: 26,
            },
        );

        expect(
            CosmeticRuleSeparatorUtils.find('example.com,example.org#@#^script:has-text(advert)'),
        ).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '#@#^',
                start: 23,
                end: 27,
            },
        );

        // ADG scriptlet
        expect(
            CosmeticRuleSeparatorUtils.find("example.com,example.org#%#//scriptlet('scriptlet', 'param0')"),
        ).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '#%#',
                start: 23,
                end: 26,
            },
        );

        expect(
            CosmeticRuleSeparatorUtils.find("example.com,example.org#@%#//scriptlet('scriptlet', 'param0')"),
        ).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '#@%#',
                start: 23,
                end: 27,
            },
        );

        // ADG HTML
        expect(
            CosmeticRuleSeparatorUtils.find('example.com,example.org$$script[tag-content="advert"]'),
        ).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '$$',
                start: 23,
                end: 25,
            },
        );

        expect(
            CosmeticRuleSeparatorUtils.find('example.com,example.org$@$script[tag-content="advert"]'),
        ).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '$@$',
                start: 23,
                end: 26,
            },
        );

        // ADG JS
        expect(
            CosmeticRuleSeparatorUtils.find('example.com,example.org#%#var a = 1;'),
        ).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '#%#',
                start: 23,
                end: 26,
            },
        );

        expect(CosmeticRuleSeparatorUtils.find('example.com,example.org#@%#var a = 1;')).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '#@%#',
                start: 23,
                end: 27,
            },
        );

        // Handle conflicts
        expect(CosmeticRuleSeparatorUtils.find('example.com$$script[tag-content="#example"]')).toMatchObject(
            <CosmeticRuleSeparatorFinderResult>{
                separator: '$$',
                start: 11,
                end: 13,
            },
        );

        // Invalid rules
        expect(CosmeticRuleSeparatorUtils.find(EMPTY)).toBeNull();
        expect(CosmeticRuleSeparatorUtils.find(SPACE)).toBeNull();

        expect(CosmeticRuleSeparatorUtils.find('#')).toBeNull();
        expect(CosmeticRuleSeparatorUtils.find('$')).toBeNull();
        expect(CosmeticRuleSeparatorUtils.find('$ $')).toBeNull();

        expect(
            CosmeticRuleSeparatorUtils.find("example.com,example.org# @%#//scriptlet('scriptlet', 'param0')"),
        ).toBeNull();

        expect(
            CosmeticRuleSeparatorUtils.find("example.com,example.org#!@%#//scriptlet('scriptlet', 'param0')"),
        ).toBeNull();

        expect(CosmeticRuleSeparatorUtils.find('example.com#.ad')).toBeNull();

        expect(CosmeticRuleSeparatorUtils.find('example.com#{}#.ad')).toBeNull();

        expect(CosmeticRuleSeparatorUtils.find('127.0.0.1 localhost ## comment')).toBeNull();
    });
});
