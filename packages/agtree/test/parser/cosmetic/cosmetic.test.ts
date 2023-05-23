/* eslint-disable max-len */
import { DomainListParser } from '../../../src/parser/misc/domain-list';
import { CssInjectionBodyParser } from '../../../src/parser/cosmetic/body/css';
import { ElementHidingBodyParser } from '../../../src/parser/cosmetic/body/elementhiding';
import { CosmeticRuleParser } from '../../../src/parser/cosmetic';
import { EMPTY, SPACE } from '../../../src/utils/constants';
import { defaultLocation } from '../../../src/parser/common';
import { locRange, shiftLoc } from '../../../src/utils/location';
import { ScriptletInjectionBodyParser } from '../../../src/parser/cosmetic/body/scriptlet';
import { HtmlFilteringBodyParser } from '../../../src/parser/cosmetic/body/html';
import { ModifierListParser } from '../../../src/parser/misc/modifier-list';
import { AdblockSyntax } from '../../../src/utils/adblockers';

describe('CosmeticRuleParser', () => {
    test('isCosmetic', async () => {
        // Invalid
        expect(CosmeticRuleParser.isCosmeticRule(EMPTY)).toBeFalsy();
        expect(CosmeticRuleParser.isCosmeticRule(SPACE)).toBeFalsy();

        expect(CosmeticRuleParser.isCosmeticRule('! This is just a comment')).toBeFalsy();
        expect(CosmeticRuleParser.isCosmeticRule('# This is just a comment')).toBeFalsy();
        expect(CosmeticRuleParser.isCosmeticRule('! Title: Something')).toBeFalsy();
        expect(CosmeticRuleParser.isCosmeticRule('! example.com##.ad')).toBeFalsy();

        expect(CosmeticRuleParser.isCosmeticRule('example.com')).toBeFalsy();
        expect(CosmeticRuleParser.isCosmeticRule('||example.com')).toBeFalsy();
        expect(CosmeticRuleParser.isCosmeticRule('||example.com^$third-party')).toBeFalsy();
        expect(CosmeticRuleParser.isCosmeticRule('/ad.js^$script')).toBeFalsy();
        expect(CosmeticRuleParser.isCosmeticRule('/^regexp$/')).toBeFalsy();
        expect(CosmeticRuleParser.isCosmeticRule('@@/^regexp$/')).toBeFalsy();

        // Valid
        expect(CosmeticRuleParser.isCosmeticRule('##.ad')).toBeTruthy();
        expect(CosmeticRuleParser.isCosmeticRule('#@#.ad')).toBeTruthy();
        expect(CosmeticRuleParser.isCosmeticRule('##+js(something)')).toBeTruthy();
        expect(CosmeticRuleParser.isCosmeticRule('#@#+js(something)')).toBeTruthy();
        expect(CosmeticRuleParser.isCosmeticRule('##^script:has-text(antiadblock)')).toBeTruthy();
        expect(CosmeticRuleParser.isCosmeticRule('$$script[tag-content="antiadblock"]')).toBeTruthy();
    });

    test('parse', async () => {
        // Valid elemhide
        expect(CosmeticRuleParser.parse('##.ad')).toMatchObject({
            category: 'Cosmetic',
            type: 'ElementHidingRule',
            loc: locRange(defaultLocation, 0, '##.ad'.length),
            syntax: 'Common',
            exception: false,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '##'.length,
                ),
                value: '##',
            },
            body: ElementHidingBodyParser.parse('.ad', shiftLoc(defaultLocation, '##'.length)),
        });

        expect(CosmeticRuleParser.parse('example.com,~example.net##.ad')).toMatchObject({
            category: 'Cosmetic',
            type: 'ElementHidingRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net##.ad'.length),
            syntax: 'Common',
            exception: false,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net##'.length,
                ),
                value: '##',
            },
            body: ElementHidingBodyParser.parse('.ad', shiftLoc(defaultLocation, 'example.com,~example.net##'.length)),
        });

        expect(CosmeticRuleParser.parse('#@#.ad')).toMatchObject({
            category: 'Cosmetic',
            type: 'ElementHidingRule',
            loc: locRange(defaultLocation, 0, '#@#.ad'.length),
            syntax: 'Common',
            exception: true,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#@#'.length,
                ),
                value: '#@#',
            },
            body: ElementHidingBodyParser.parse('.ad', shiftLoc(defaultLocation, '#@#'.length)),
        });

        expect(CosmeticRuleParser.parse('example.com,~example.net#@#.ad')).toMatchObject({
            category: 'Cosmetic',
            type: 'ElementHidingRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#@#.ad'.length),
            syntax: 'Common',
            exception: true,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#@#'.length,
                ),
                value: '#@#',
            },
            body: ElementHidingBodyParser.parse('.ad', shiftLoc(defaultLocation, 'example.com,~example.net#@#'.length)),
        });

        // Valid elemhide (extended)
        expect(CosmeticRuleParser.parse('#?#.ad:-abp-has(.ad)')).toMatchObject({
            category: 'Cosmetic',
            type: 'ElementHidingRule',
            loc: locRange(defaultLocation, 0, '#?#.ad:-abp-has(.ad)'.length),
            syntax: 'Common',
            exception: false,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#?#'.length,
                ),
                value: '#?#',
            },
            body: ElementHidingBodyParser.parse(
                '.ad:-abp-has(.ad)',
                shiftLoc(defaultLocation, '#?#'.length),
            ),
        });

        expect(CosmeticRuleParser.parse('example.com,~example.net#?#.ad:-abp-has(.ad)')).toMatchObject({
            category: 'Cosmetic',
            type: 'ElementHidingRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#?#.ad:-abp-has(.ad)'.length),
            syntax: 'Common',
            exception: false,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#?#'.length,
                ),
                value: '#?#',
            },
            body: ElementHidingBodyParser.parse(
                '.ad:-abp-has(.ad)',
                shiftLoc(defaultLocation, 'example.com,~example.net#?#'.length),
            ),
        });

        expect(CosmeticRuleParser.parse('#@?#.ad:-abp-has(.ad)')).toMatchObject({
            category: 'Cosmetic',
            type: 'ElementHidingRule',
            loc: locRange(defaultLocation, 0, '#@?#.ad:-abp-has(.ad)'.length),
            syntax: 'Common',
            exception: true,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#@?#'.length,
                ),
                value: '#@?#',
            },
            body: ElementHidingBodyParser.parse(
                '.ad:-abp-has(.ad)',
                shiftLoc(defaultLocation, '#@?#'.length),
            ),
        });

        expect(CosmeticRuleParser.parse('example.com,~example.net#@?#.ad:-abp-has(.ad)')).toMatchObject({
            category: 'Cosmetic',
            type: 'ElementHidingRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#@?#.ad:-abp-has(.ad)'.length),
            syntax: 'Common',
            exception: true,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#@?#'.length,
                ),
                value: '#@?#',
            },
            body: ElementHidingBodyParser.parse(
                '.ad:-abp-has(.ad)',
                shiftLoc(defaultLocation, 'example.com,~example.net#@?#'.length),
            ),
        });

        // CSS injections (AdGuard)
        expect(CosmeticRuleParser.parse('#$#body { padding: 0; }')).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, '#$#body { padding: 0; }'.length),
            syntax: 'AdGuard',
            exception: false,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#$#'.length,
                ),
                value: '#$#',
            },
            body: CssInjectionBodyParser.parse(
                'body { padding: 0; }',
                shiftLoc(defaultLocation, '#$#'.length),
            ),
        });

        expect(CosmeticRuleParser.parse('example.com,~example.net#$#body { padding: 0; }')).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#$#body { padding: 0; }'.length),
            syntax: 'AdGuard',
            exception: false,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#$#'.length,
                ),
                value: '#$#',
            },
            body: CssInjectionBodyParser.parse(
                'body { padding: 0; }',
                shiftLoc(defaultLocation, 'example.com,~example.net#$#'.length),
            ),
        });

        expect(CosmeticRuleParser.parse('#@$#body { padding: 0; }')).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, '#@$#body { padding: 0; }'.length),
            syntax: 'AdGuard',
            exception: true,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#@$#'.length,
                ),
                value: '#@$#',
            },
            body: CssInjectionBodyParser.parse(
                'body { padding: 0; }',
                shiftLoc(defaultLocation, '#@$#'.length),
            ),
        });

        expect(CosmeticRuleParser.parse('example.com,~example.net#@$#body { padding: 0; }')).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#@$#body { padding: 0; }'.length),
            syntax: 'AdGuard',
            exception: true,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#@$#'.length,
                ),
                value: '#@$#',
            },
            body: CssInjectionBodyParser.parse(
                'body { padding: 0; }',
                shiftLoc(defaultLocation, 'example.com,~example.net#@$#'.length),
            ),
        });

        // CSS injections with media queries (AdGuard)
        expect(
            CosmeticRuleParser.parse('#$#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }'),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, '#$#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }'.length),
            syntax: 'AdGuard',
            exception: false,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#$#'.length,
                ),
                value: '#$#',
            },
            body: CssInjectionBodyParser.parse(
                '@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }',
                shiftLoc(defaultLocation, '#$#'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse('#$#@media(min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }'),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, '#$#@media(min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }'.length),
            syntax: 'AdGuard',
            exception: false,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#$#'.length,
                ),
                value: '#$#',
            },
            body: CssInjectionBodyParser.parse(
                '@media(min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }',
                shiftLoc(defaultLocation, '#$#'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net#$#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#$#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }'.length),
            syntax: 'AdGuard',
            exception: false,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#$#'.length,
                ),
                value: '#$#',
            },
            body: CssInjectionBodyParser.parse(
                '@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }',
                shiftLoc(defaultLocation, 'example.com,~example.net#$#'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net#@$#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#@$#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }'.length),
            syntax: 'AdGuard',
            exception: true,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#@$#'.length,
                ),
                value: '#@$#',
            },
            body: CssInjectionBodyParser.parse(
                '@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }',
                shiftLoc(defaultLocation, 'example.com,~example.net#@$#'.length),
            ),
        });

        // CSS injections with Extended CSS (AdGuard)
        expect(CosmeticRuleParser.parse('#$?#body:-abp-has(.ad) { padding: 0; }')).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, '#$?#body:-abp-has(.ad) { padding: 0; }'.length),
            syntax: 'AdGuard',
            exception: false,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#$?#'.length,
                ),
                value: '#$?#',
            },
            body: CssInjectionBodyParser.parse(
                'body:-abp-has(.ad) { padding: 0; }',
                shiftLoc(defaultLocation, '#$?#'.length),
            ),
        });

        expect(CosmeticRuleParser.parse('example.com,~example.net#$?#body:-abp-has(.ad) { padding: 0; }')).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#$?#body:-abp-has(.ad) { padding: 0; }'.length),
            syntax: 'AdGuard',
            exception: false,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#$?#'.length,
                ),
                value: '#$?#',
            },
            body: CssInjectionBodyParser.parse(
                'body:-abp-has(.ad) { padding: 0; }',
                shiftLoc(defaultLocation, 'example.com,~example.net#$?#'.length),
            ),
        });

        expect(CosmeticRuleParser.parse('#@$?#body:-abp-has(.ad) { padding: 0; }')).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, '#@$?#body:-abp-has(.ad) { padding: 0; }'.length),
            syntax: 'AdGuard',
            exception: true,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#@$?#'.length,
                ),
                value: '#@$?#',
            },
            body: CssInjectionBodyParser.parse(
                'body:-abp-has(.ad) { padding: 0; }',
                shiftLoc(defaultLocation, '#@$?#'.length),
            ),
        });

        expect(CosmeticRuleParser.parse('example.com,~example.net#@$?#body:-abp-has(.ad) { padding: 0; }')).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#@$?#body:-abp-has(.ad) { padding: 0; }'.length),
            syntax: 'AdGuard',
            exception: true,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#@$?#'.length,
                ),
                value: '#@$?#',
            },
            body: CssInjectionBodyParser.parse(
                'body:-abp-has(.ad) { padding: 0; }',
                shiftLoc(defaultLocation, 'example.com,~example.net#@$?#'.length),
            ),
        });

        // CSS injections with Extended CSS and media queries (AdGuard)
        expect(
            CosmeticRuleParser.parse(
                '#$?#@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0 !important; } }',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, '#$?#@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0 !important; } }'.length),
            syntax: 'AdGuard',
            exception: false,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#$?#'.length,
                ),
                value: '#$?#',
            },
            body: CssInjectionBodyParser.parse(
                '@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0 !important; } }',
                shiftLoc(defaultLocation, '#$?#'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net#$?#@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0 !important; } }',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#$?#@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0 !important; } }'.length),
            syntax: 'AdGuard',
            exception: false,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#$?#'.length,
                ),
                value: '#$?#',
            },
            body: CssInjectionBodyParser.parse(
                '@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0 !important; } }',
                shiftLoc(defaultLocation, 'example.com,~example.net#$?#'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                '#@$?#@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0 !important; } }',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, '#@$?#@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0 !important; } }'.length),
            syntax: 'AdGuard',
            exception: true,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#@$?#'.length,
                ),
                value: '#@$?#',
            },
            body: CssInjectionBodyParser.parse(
                '@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0 !important; } }',
                shiftLoc(defaultLocation, '#@$?#'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net#@$?#@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0 !important; } }',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#@$?#@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0 !important; } }'.length),
            syntax: 'AdGuard',
            exception: true,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#@$?#'.length,
                ),
                value: '#@$?#',
            },
            body: CssInjectionBodyParser.parse(
                '@media (min-height: 1024px) and (max-height: 1920px) { body:-abp-has(.ad) { padding: 0 !important; } }',
                shiftLoc(defaultLocation, 'example.com,~example.net#@$?#'.length),
            ),
        });

        // CSS injection (uBlock Origin)
        expect(
            CosmeticRuleParser.parse(
                '##body:style(padding: 0;)',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, '##body:style(padding: 0;)'.length),
            syntax: 'UblockOrigin',
            exception: false,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '##'.length,
                ),
                value: '##',
            },
            body: CssInjectionBodyParser.parse(
                'body:style(padding: 0;)',
                shiftLoc(defaultLocation, '##'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net##body:style(padding: 0;)',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net##body:style(padding: 0;)'.length),
            syntax: 'UblockOrigin',
            exception: false,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net##'.length,
                ),
                value: '##',
            },
            body: CssInjectionBodyParser.parse(
                'body:style(padding: 0;)',
                shiftLoc(defaultLocation, 'example.com,~example.net##'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                '#@#body:style(padding: 0;)',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, '#@#body:style(padding: 0;)'.length),
            syntax: 'UblockOrigin',
            exception: true,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#@#'.length,
                ),
                value: '#@#',
            },
            body: CssInjectionBodyParser.parse(
                'body:style(padding: 0;)',
                shiftLoc(defaultLocation, '#@#'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net#@#body:style(padding: 0;)',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#@#body:style(padding: 0;)'.length),
            syntax: 'UblockOrigin',
            exception: true,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#@#'.length,
                ),
                value: '#@#',
            },
            body: CssInjectionBodyParser.parse(
                'body:style(padding: 0;)',
                shiftLoc(defaultLocation, 'example.com,~example.net#@#'.length),
            ),
        });

        // CSS injection with ExtendedCSS and media queries (uBlock Origin)
        expect(
            CosmeticRuleParser.parse(
                '##body > .container:has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, '##body > .container:has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)'.length),
            syntax: 'UblockOrigin',
            exception: false,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '##'.length,
                ),
                value: '##',
            },
            body: CssInjectionBodyParser.parse(
                'body > .container:has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)',
                shiftLoc(defaultLocation, '##'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net##body > .container:has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net##body > .container:has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)'.length),
            syntax: 'UblockOrigin',
            exception: false,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net##'.length,
                ),
                value: '##',
            },
            body: CssInjectionBodyParser.parse(
                'body > .container:has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)',
                shiftLoc(defaultLocation, 'example.com,~example.net##'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                '#@#body > .container:has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, '#@#body > .container:has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)'.length),
            syntax: 'UblockOrigin',
            exception: true,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#@#'.length,
                ),
                value: '#@#',
            },
            body: CssInjectionBodyParser.parse(
                'body > .container:has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)',
                shiftLoc(defaultLocation, '#@#'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net#@#body > .container:has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'CssInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net##@body > .container:has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)'.length),
            syntax: 'UblockOrigin',
            exception: true,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#@#'.length,
                ),
                value: '#@#',
            },
            body: CssInjectionBodyParser.parse(
                'body > .container:has-text(/ad/):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0 !important;)',
                shiftLoc(defaultLocation, 'example.com,~example.net#@#'.length),
            ),
        });

        // Scriptlet injections (AdGuard)
        expect(
            CosmeticRuleParser.parse(
                "#%#//scriptlet('scriptlet0', 'arg0', 'arg1')",
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'ScriptletInjectionRule',
            loc: locRange(defaultLocation, 0, "#%#//scriptlet('scriptlet0', 'arg0', 'arg1')".length),
            syntax: 'AdGuard',
            exception: false,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#%#'.length,
                ),
                value: '#%#',
            },
            body: ScriptletInjectionBodyParser.parse(
                "//scriptlet('scriptlet0', 'arg0', 'arg1')",
                AdblockSyntax.Adg,
                shiftLoc(defaultLocation, '#%#'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                "example.com,~example.net#%#//scriptlet('scriptlet0', 'arg0', 'arg1')",
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'ScriptletInjectionRule',
            loc: locRange(defaultLocation, 0, "example.com,~example.net#%#//scriptlet('scriptlet0', 'arg0', 'arg1')".length),
            syntax: 'AdGuard',
            exception: false,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#%#'.length,
                ),
                value: '#%#',
            },
            body: ScriptletInjectionBodyParser.parse(
                "//scriptlet('scriptlet0', 'arg0', 'arg1')",
                AdblockSyntax.Adg,
                shiftLoc(defaultLocation, 'example.com,~example.net#%#'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                "#@%#//scriptlet('scriptlet0', 'arg0', 'arg1')",
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'ScriptletInjectionRule',
            loc: locRange(defaultLocation, 0, "#@%#//scriptlet('scriptlet0', 'arg0', 'arg1')".length),
            syntax: 'AdGuard',
            exception: true,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#@%#'.length,
                ),
                value: '#@%#',
            },
            body: ScriptletInjectionBodyParser.parse(
                "//scriptlet('scriptlet0', 'arg0', 'arg1')",
                AdblockSyntax.Adg,
                shiftLoc(defaultLocation, '#@%#'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                "example.com,~example.net#@%#//scriptlet('scriptlet0', 'arg0', 'arg1')",
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'ScriptletInjectionRule',
            loc: locRange(defaultLocation, 0, "example.com,~example.net#@%#//scriptlet('scriptlet0', 'arg0', 'arg1')".length),
            syntax: 'AdGuard',
            exception: true,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#@%#'.length,
                ),
                value: '#@%#',
            },
            body: ScriptletInjectionBodyParser.parse(
                "//scriptlet('scriptlet0', 'arg0', 'arg1')",
                AdblockSyntax.Adg,
                shiftLoc(defaultLocation, 'example.com,~example.net#@%#'.length),
            ),
        });

        // Scriptlet injections (uBlock Origin)
        expect(
            CosmeticRuleParser.parse(
                '##+js(scriptlet0, arg0, arg1)',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'ScriptletInjectionRule',
            loc: locRange(defaultLocation, 0, '##+js(scriptlet0, arg0, arg1)'.length),
            syntax: 'UblockOrigin',
            exception: false,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '##+'.length,
                ),
                value: '##+',
            },
            body: ScriptletInjectionBodyParser.parse(
                'js(scriptlet0, arg0, arg1)',
                AdblockSyntax.Ubo,
                shiftLoc(defaultLocation, '##+'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net##+js(scriptlet0, arg0, arg1)',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'ScriptletInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net##+js(scriptlet0, arg0, arg1)'.length),
            syntax: 'UblockOrigin',
            exception: false,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net##+'.length,
                ),
                value: '##+',
            },
            body: ScriptletInjectionBodyParser.parse(
                'js(scriptlet0, arg0, arg1)',
                AdblockSyntax.Ubo,
                shiftLoc(defaultLocation, 'example.com,~example.net##+'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                '#@#+js(scriptlet0, arg0, arg1)',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'ScriptletInjectionRule',
            loc: locRange(defaultLocation, 0, '#@#+js(scriptlet0, arg0, arg1)'.length),
            syntax: 'UblockOrigin',
            exception: true,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#@#+'.length,
                ),
                value: '#@#+',
            },
            body: ScriptletInjectionBodyParser.parse(
                'js(scriptlet0, arg0, arg1)',
                AdblockSyntax.Ubo,
                shiftLoc(defaultLocation, '#@#+'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net#@#+js(scriptlet0, arg0, arg1)',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'ScriptletInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#@#+js(scriptlet0, arg0, arg1)'.length),
            syntax: 'UblockOrigin',
            exception: true,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#@#+'.length,
                ),
                value: '#@#+',
            },
            body: ScriptletInjectionBodyParser.parse(
                'js(scriptlet0, arg0, arg1)',
                AdblockSyntax.Ubo,
                shiftLoc(defaultLocation, 'example.com,~example.net#@#+'.length),
            ),
        });

        // Scriptlet injections (Adblack Plus)
        expect(
            CosmeticRuleParser.parse(
                '#$#scriptlet0 arg0 arg1',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'ScriptletInjectionRule',
            loc: locRange(defaultLocation, 0, '#$#scriptlet0 arg0 arg1'.length),
            syntax: 'AdblockPlus',
            exception: false,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#$#'.length,
                ),
                value: '#$#',
            },
            body: ScriptletInjectionBodyParser.parse(
                'scriptlet0 arg0 arg1',
                AdblockSyntax.Abp,
                shiftLoc(defaultLocation, '#$#'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net#$#scriptlet0 arg0 arg1',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'ScriptletInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#$#scriptlet0 arg0 arg1'.length),
            syntax: 'AdblockPlus',
            exception: false,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#$#'.length,
                ),
                value: '#$#',
            },
            body: ScriptletInjectionBodyParser.parse(
                'scriptlet0 arg0 arg1',
                AdblockSyntax.Abp,
                shiftLoc(defaultLocation, 'example.com,~example.net#$#'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                '#@$#scriptlet0 arg0 arg1',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'ScriptletInjectionRule',
            loc: locRange(defaultLocation, 0, '#@$#scriptlet0 arg0 arg1'.length),
            syntax: 'AdblockPlus',
            exception: true,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#@$#'.length,
                ),
                value: '#@$#',
            },
            body: ScriptletInjectionBodyParser.parse(
                'scriptlet0 arg0 arg1',
                AdblockSyntax.Abp,
                shiftLoc(defaultLocation, '#@$#'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net#@$#scriptlet0 arg0 arg1',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'ScriptletInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#@$#scriptlet0 arg0 arg1'.length),
            syntax: 'AdblockPlus',
            exception: true,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#@$#'.length,
                ),
                value: '#@$#',
            },
            body: ScriptletInjectionBodyParser.parse(
                'scriptlet0 arg0 arg1',
                AdblockSyntax.Abp,
                shiftLoc(defaultLocation, 'example.com,~example.net#@$#'.length),
            ),
        });

        // Scriptlet injections (Adblock Syntax) - multiple scriptlets in one rule
        expect(
            CosmeticRuleParser.parse(
                '#$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'ScriptletInjectionRule',
            loc: locRange(defaultLocation, 0, '#$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11'.length),
            syntax: 'AdblockPlus',
            exception: false,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#$#'.length,
                ),
                value: '#$#',
            },
            body: ScriptletInjectionBodyParser.parse(
                'scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
                AdblockSyntax.Abp,
                shiftLoc(defaultLocation, '#$#'.length),
            ),
        });

        // Redundant ; at the end of the rule
        expect(
            CosmeticRuleParser.parse(
                '#$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'ScriptletInjectionRule',
            loc: locRange(defaultLocation, 0, '#$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;'.length),
            syntax: 'AdblockPlus',
            exception: false,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#$#'.length,
                ),
                value: '#$#',
            },
            body: ScriptletInjectionBodyParser.parse(
                'scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;',
                AdblockSyntax.Abp,
                shiftLoc(defaultLocation, '#$#'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net#$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'ScriptletInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11'.length),
            syntax: 'AdblockPlus',
            exception: false,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#$#'.length,
                ),
                value: '#$#',
            },
            body: ScriptletInjectionBodyParser.parse(
                'scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
                AdblockSyntax.Abp,
                shiftLoc(defaultLocation, 'example.com,~example.net#$#'.length),
            ),
        });

        // Redundant ; at the end of the rule
        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net#$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'ScriptletInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;'.length),
            syntax: 'AdblockPlus',
            exception: false,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#$#'.length,
                ),
                value: '#$#',
            },
            body: ScriptletInjectionBodyParser.parse(
                'scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;',
                AdblockSyntax.Abp,
                shiftLoc(defaultLocation, 'example.com,~example.net#$#'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                '#@$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'ScriptletInjectionRule',
            loc: locRange(defaultLocation, 0, '#@$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11'.length),
            syntax: 'AdblockPlus',
            exception: true,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#@$#'.length,
                ),
                value: '#@$#',
            },
            body: ScriptletInjectionBodyParser.parse(
                'scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
                AdblockSyntax.Abp,
                shiftLoc(defaultLocation, '#@$#'.length),
            ),
        });

        // Redundant ; at the end of the rule
        expect(
            CosmeticRuleParser.parse(
                '#@$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'ScriptletInjectionRule',
            loc: locRange(defaultLocation, 0, '#@$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;'.length),
            syntax: 'AdblockPlus',
            exception: true,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#@$#'.length,
                ),
                value: '#@$#',
            },
            body: ScriptletInjectionBodyParser.parse(
                'scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;',
                AdblockSyntax.Abp,
                shiftLoc(defaultLocation, '#@$#'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net#@$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'ScriptletInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#@$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11'.length),
            syntax: 'AdblockPlus',
            exception: true,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#@$#'.length,
                ),
                value: '#@$#',
            },
            body: ScriptletInjectionBodyParser.parse(
                'scriptlet0 arg00 arg01; scriptlet1 arg10 arg11',
                AdblockSyntax.Abp,
                shiftLoc(defaultLocation, 'example.com,~example.net#@$#'.length),
            ),
        });

        // Redundant ; at the end of the rule
        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net#@$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'ScriptletInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#@$#scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;'.length),
            syntax: 'AdblockPlus',
            exception: true,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#@$#'.length,
                ),
                value: '#@$#',
            },
            body: ScriptletInjectionBodyParser.parse(
                'scriptlet0 arg00 arg01; scriptlet1 arg10 arg11;',
                AdblockSyntax.Abp,
                shiftLoc(defaultLocation, 'example.com,~example.net#@$#'.length),
            ),
        });

        // HTML filtering rules (AdGuard)
        expect(
            CosmeticRuleParser.parse(
                '$$script[tag-content="adblock"]',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'HtmlFilteringRule',
            loc: locRange(defaultLocation, 0, '$$script[tag-content="adblock"]'.length),
            syntax: 'AdGuard',
            exception: false,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '$$'.length,
                ),
                value: '$$',
            },
            body: HtmlFilteringBodyParser.parse(
                'script[tag-content="adblock"]',
                shiftLoc(defaultLocation, '$$'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net$$script[tag-content="adblock"]',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'HtmlFilteringRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net$$script[tag-content="adblock"]'.length),
            syntax: 'AdGuard',
            exception: false,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net$$'.length,
                ),
                value: '$$',
            },
            body: HtmlFilteringBodyParser.parse(
                'script[tag-content="adblock"]',
                shiftLoc(defaultLocation, 'example.com,~example.net$$'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                '$@$script[tag-content="adblock"]',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'HtmlFilteringRule',
            loc: locRange(defaultLocation, 0, '$@$script[tag-content="adblock"]'.length),
            syntax: 'AdGuard',
            exception: true,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '$@$'.length,
                ),
                value: '$@$',
            },
            body: HtmlFilteringBodyParser.parse(
                'script[tag-content="adblock"]',
                shiftLoc(defaultLocation, '$@$'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net$@$script[tag-content="adblock"]',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'HtmlFilteringRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net$@$script[tag-content="adblock"]'.length),
            syntax: 'AdGuard',
            exception: true,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net$@$'.length,
                ),
                value: '$@$',
            },
            body: HtmlFilteringBodyParser.parse(
                'script[tag-content="adblock"]',
                shiftLoc(defaultLocation, 'example.com,~example.net$@$'.length),
            ),
        });

        // HTML filtering rules (uBlock Origin)
        expect(
            CosmeticRuleParser.parse(
                '##^script:has-text(adblock)',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'HtmlFilteringRule',
            loc: locRange(defaultLocation, 0, '##^script:has-text(adblock)'.length),
            syntax: 'UblockOrigin',
            exception: false,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '##^'.length,
                ),
                value: '##^',
            },
            body: HtmlFilteringBodyParser.parse(
                'script:has-text(adblock)',
                shiftLoc(defaultLocation, '##^'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net##^script:has-text(adblock)',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'HtmlFilteringRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net##^script:has-text(adblock)'.length),
            syntax: 'UblockOrigin',
            exception: false,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net##^'.length,
                ),
                value: '##^',
            },
            body: HtmlFilteringBodyParser.parse(
                'script:has-text(adblock)',
                shiftLoc(defaultLocation, 'example.com,~example.net##^'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                '#@#^script:has-text(adblock)',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'HtmlFilteringRule',
            loc: locRange(defaultLocation, 0, '#@#^script:has-text(adblock)'.length),
            syntax: 'UblockOrigin',
            exception: true,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#@#^'.length,
                ),
                value: '#@#^',
            },
            body: HtmlFilteringBodyParser.parse(
                'script:has-text(adblock)',
                shiftLoc(defaultLocation, '#@#^'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net#@#^script:has-text(adblock)',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'HtmlFilteringRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#@#^script:has-text(adblock)'.length),
            syntax: 'UblockOrigin',
            exception: true,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#@#^'.length,
                ),
                value: '#@#^',
            },
            body: HtmlFilteringBodyParser.parse(
                'script:has-text(adblock)',
                shiftLoc(defaultLocation, 'example.com,~example.net#@#^'.length),
            ),
        });

        // HTML filtering rules (uBlock Origin) - multiple selectors
        expect(
            CosmeticRuleParser.parse(
                '##^script:has-text(adblock), script:has-text(detector)',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'HtmlFilteringRule',
            loc: locRange(defaultLocation, 0, '##^script:has-text(adblock), script:has-text(detector)'.length),
            syntax: 'UblockOrigin',
            exception: false,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '##^'.length,
                ),
                value: '##^',
            },
            body: HtmlFilteringBodyParser.parse(
                'script:has-text(adblock), script:has-text(detector)',
                shiftLoc(defaultLocation, '##^'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net##^script:has-text(adblock), script:has-text(detector)',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'HtmlFilteringRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net##^script:has-text(adblock), script:has-text(detector)'.length),
            syntax: 'UblockOrigin',
            exception: false,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net##^'.length,
                ),
                value: '##^',
            },
            body: HtmlFilteringBodyParser.parse(
                'script:has-text(adblock), script:has-text(detector)',
                shiftLoc(defaultLocation, 'example.com,~example.net##^'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                '#@#^script:has-text(adblock), script:has-text(detector)',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'HtmlFilteringRule',
            loc: locRange(defaultLocation, 0, '#@#^script:has-text(adblock), script:has-text(detector)'.length),
            syntax: 'UblockOrigin',
            exception: true,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#@#^'.length,
                ),
                value: '#@#^',
            },
            body: HtmlFilteringBodyParser.parse(
                'script:has-text(adblock), script:has-text(detector)',
                shiftLoc(defaultLocation, '#@#^'.length),
            ),
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net#@#^script:has-text(adblock), script:has-text(detector)',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'HtmlFilteringRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#@#^script:has-text(adblock), script:has-text(detector)'.length),
            syntax: 'UblockOrigin',
            exception: true,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#@#^'.length,
                ),
                value: '#@#^',
            },
            body: HtmlFilteringBodyParser.parse(
                'script:has-text(adblock), script:has-text(detector)',
                shiftLoc(defaultLocation, 'example.com,~example.net#@#^'.length),
            ),
        });

        // JS injections (AdGuard)
        expect(
            CosmeticRuleParser.parse(
                '#%#const a = 2;',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'JsInjectionRule',
            loc: locRange(defaultLocation, 0, '#%#const a = 2;'.length),
            syntax: 'AdGuard',
            exception: false,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#%#'.length,
                ),
                value: '#%#',
            },
            body: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    '#%#'.length,
                    '#%#const a = 2;'.length,
                ),
                value: 'const a = 2;',
            },
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net#%#const a = 2;',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'JsInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#%#const a = 2;'.length),
            syntax: 'AdGuard',
            exception: false,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#%#'.length,
                ),
                value: '#%#',
            },
            body: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net#%#'.length,
                    'example.com,~example.net#%#const a = 2;'.length,
                ),
                value: 'const a = 2;',
            },
        });

        expect(
            CosmeticRuleParser.parse(
                '#@%#const a = 2;',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'JsInjectionRule',
            loc: locRange(defaultLocation, 0, '#@%#const a = 2;'.length),
            syntax: 'AdGuard',
            exception: true,
            domains: DomainListParser.parse('', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    ''.length,
                    '#@%#'.length,
                ),
                value: '#@%#',
            },
            body: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    '#@%#'.length,
                    '#@%#const a = 2;'.length,
                ),
                value: 'const a = 2;',
            },
        });

        expect(
            CosmeticRuleParser.parse(
                'example.com,~example.net#@%#const a = 2;',
            ),
        ).toMatchObject({
            category: 'Cosmetic',
            type: 'JsInjectionRule',
            loc: locRange(defaultLocation, 0, 'example.com,~example.net#@%#const a = 2;'.length),
            syntax: 'AdGuard',
            exception: true,
            domains: DomainListParser.parse('example.com,~example.net', ',', defaultLocation),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net'.length,
                    'example.com,~example.net#@%#'.length,
                ),
                value: '#@%#',
            },
            body: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    'example.com,~example.net#@%#'.length,
                    'example.com,~example.net#@%#const a = 2;'.length,
                ),
                value: 'const a = 2;',
            },
        });

        // AdGuard modifiers/options
        expect(CosmeticRuleParser.parse('[$app=com.something]##.ad')).toMatchObject({
            category: 'Cosmetic',
            type: 'ElementHidingRule',
            loc: locRange(defaultLocation, 0, '[$app=com.something]##.ad'.length),
            syntax: 'AdGuard',
            exception: false,
            modifiers: ModifierListParser.parse(
                'app=com.something',
                shiftLoc(defaultLocation, 2), // shift [$
            ),
            domains: DomainListParser.parse('', ',', shiftLoc(
                defaultLocation,
                '[$app=com.something]'.length,
            )),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    '[$app=com.something]'.length,
                    '[$app=com.something]##'.length,
                ),
                value: '##',
            },
            body: ElementHidingBodyParser.parse(
                '.ad',
                shiftLoc(defaultLocation, '[$app=com.something]##'.length),
            ),
        });

        expect(CosmeticRuleParser.parse('[$app=com.something,b=c]example.com,~example.net##.ad')).toMatchObject({
            category: 'Cosmetic',
            type: 'ElementHidingRule',
            loc: locRange(defaultLocation, 0, '[$app=com.something,b=c]example.com,~example.net##.ad'.length),
            syntax: 'AdGuard',
            exception: false,
            modifiers: ModifierListParser.parse(
                'app=com.something,b=c',
                shiftLoc(defaultLocation, 2), // shift [$
            ),
            domains: DomainListParser.parse('example.com,~example.net', ',', shiftLoc(
                defaultLocation,
                '[$app=com.something,b=c]'.length,
            )),
            separator: {
                type: 'Value',
                loc: locRange(
                    defaultLocation,
                    '[$app=com.something,b=c]example.com,~example.net'.length,
                    '[$app=com.something,b=c]example.com,~example.net##'.length,
                ),
                value: '##',
            },
            body: ElementHidingBodyParser.parse(
                '.ad',
                shiftLoc(defaultLocation, '[$app=com.something,b=c]example.com,~example.net##'.length),
            ),
        });

        // Invalid
        expect(CosmeticRuleParser.parse(EMPTY)).toBeNull();
        expect(CosmeticRuleParser.parse(SPACE)).toBeNull();

        expect(CosmeticRuleParser.parse('body')).toBeNull();
        expect(CosmeticRuleParser.parse('body > .ad')).toBeNull();
        expect(CosmeticRuleParser.parse('#')).toBeNull();
        expect(CosmeticRuleParser.parse('# test')).toBeNull();
        expect(CosmeticRuleParser.parse('! test')).toBeNull();
        expect(CosmeticRuleParser.parse('-ad-350px-')).toBeNull();

        expect(() => CosmeticRuleParser.parse('#$?#scriptlet')).toThrowError(
            'Separator \'#$?#\' is not supported for scriptlet injection',
        );

        expect(() => CosmeticRuleParser.parse('#@$?#scriptlet')).toThrowError(
            'Separator \'#@$?#\' is not supported for scriptlet injection',
        );

        expect(() => CosmeticRuleParser.parse('[a=b]#%#const a = 2;')).toThrowError(
            /^Missing \$ at the beginning of the AdGuard modifier list in pattern/,
        );

        expect(() => CosmeticRuleParser.parse('[$a=b#%#const a = 2;')).toThrowError(
            /^Missing \] at the end of the AdGuard modifier list in pattern/,
        );

        expect(() => CosmeticRuleParser.parse('[$a=b]#$#abp-snippet')).toThrowError(
            'AdGuard modifier list is not supported in ABP snippet injection rules',
        );

        expect(() => CosmeticRuleParser.parse('[$a=b]##+js(scriptlet)')).toThrowError(
            'AdGuard modifier list is not supported in uBO scriptlet injection rules',
        );

        expect(() => CosmeticRuleParser.parse('[$a=b]##body:style(padding:0)')).toThrowError(
            'AdGuard modifier list is not supported in uBO CSS injection rules',
        );

        expect(() => CosmeticRuleParser.parse('[$a=b]##^script:has-text(ads)')).toThrowError(
            'AdGuard modifier list is not supported in uBO HTML filtering rules',
        );

        expect(() => CosmeticRuleParser.parse('$$responseheader(header-name)')).toThrowError(
            'Functions are not supported in ADG HTML filtering rules',
        );

        expect(() => CosmeticRuleParser.parse('#%#')).toThrowError(
            'Empty body in JS injection rule',
        );

        expect(() => CosmeticRuleParser.parse('example.com#%#')).toThrowError(
            'Empty body in JS injection rule',
        );
    });

    test('generate', async () => {
        const parseAndGenerate = (raw: string) => {
            const ast = CosmeticRuleParser.parse(raw);

            if (ast) {
                return CosmeticRuleParser.generate(ast);
            }

            return null;
        };

        // Element hiding
        expect(parseAndGenerate('##.ad')).toEqual('##.ad');
        expect(parseAndGenerate('example.com,~example.net##.ad')).toEqual('example.com,~example.net##.ad');
        expect(parseAndGenerate('#@#.ad')).toEqual('#@#.ad');
        expect(parseAndGenerate('example.com,~example.net#@#.ad')).toEqual('example.com,~example.net#@#.ad');

        // Element hiding with Extended CSS
        expect(parseAndGenerate('#?#.ad:-abp-has(.ad)')).toEqual('#?#.ad:-abp-has(.ad)');
        expect(parseAndGenerate('example.com,~example.net#?#.ad:-abp-has(.ad)')).toEqual(
            'example.com,~example.net#?#.ad:-abp-has(.ad)',
        );
        expect(parseAndGenerate('#@?#.ad:-abp-has(.ad)')).toEqual('#@?#.ad:-abp-has(.ad)');
        expect(parseAndGenerate('example.com,~example.net#@?#.ad:-abp-has(.ad)')).toEqual(
            'example.com,~example.net#@?#.ad:-abp-has(.ad)',
        );

        // AdGuard CSS injection
        expect(parseAndGenerate('#$#body { padding: 0; }')).toEqual('#$#body { padding: 0; }');
        expect(parseAndGenerate('example.com,~example.net#$#body { padding: 0; }')).toEqual(
            'example.com,~example.net#$#body { padding: 0; }',
        );
        expect(parseAndGenerate('#@$#body { padding: 0; }')).toEqual('#@$#body { padding: 0; }');
        expect(parseAndGenerate('example.com,~example.net#@$#body { padding: 0; }')).toEqual(
            'example.com,~example.net#@$#body { padding: 0; }',
        );

        // AdGuard CSS injection with Extended CSS
        expect(parseAndGenerate('#$?#body:-abp-has(.ad) { padding: 0; }')).toEqual(
            '#$?#body:-abp-has(.ad) { padding: 0; }',
        );
        expect(parseAndGenerate('example.com,~example.net#$?#body:-abp-has(.ad) { padding: 0; }')).toEqual(
            'example.com,~example.net#$?#body:-abp-has(.ad) { padding: 0; }',
        );
        expect(parseAndGenerate('#@$?#body:-abp-has(.ad) { padding: 0; }')).toEqual(
            '#@$?#body:-abp-has(.ad) { padding: 0; }',
        );
        expect(parseAndGenerate('example.com,~example.net#@$?#body:-abp-has(.ad) { padding: 0; }')).toEqual(
            'example.com,~example.net#@$?#body:-abp-has(.ad) { padding: 0; }',
        );

        // AdGuard CSS injection with Extended CSS and media query
        expect(parseAndGenerate('#$?#@media (min-width: 1024px) { body:-abp-has(.ad) { padding: 0; } }')).toEqual(
            '#$?#@media (min-width: 1024px) { body:-abp-has(.ad) { padding: 0; } }',
        );

        // Tolerant (space missing after at-rule name)
        expect(parseAndGenerate('#$?#@media(min-width: 1024px) { body:-abp-has(.ad) { padding: 0; } }')).toEqual(
            '#$?#@media (min-width: 1024px) { body:-abp-has(.ad) { padding: 0; } }',
        );

        expect(
            parseAndGenerate(
                'example.com,~example.net#$?#@media (min-width: 1024px) { body:-abp-has(.ad) { padding: 0; } }',
            ),
        ).toEqual('example.com,~example.net#$?#@media (min-width: 1024px) { body:-abp-has(.ad) { padding: 0; } }');
        expect(parseAndGenerate('#@$?#@media (min-width: 1024px) { body:-abp-has(.ad) { padding: 0; } }')).toEqual(
            '#@$?#@media (min-width: 1024px) { body:-abp-has(.ad) { padding: 0; } }',
        );
        expect(
            parseAndGenerate(
                'example.com,~example.net#@$?#@media (min-width: 1024px) { body:-abp-has(.ad) { padding: 0; } }',
            ),
        ).toEqual('example.com,~example.net#@$?#@media (min-width: 1024px) { body:-abp-has(.ad) { padding: 0; } }');

        // uBlock CSS injection
        expect(parseAndGenerate('##body:style(padding: 0;)')).toEqual('##body:style(padding: 0;)');
        expect(parseAndGenerate('example.com,~example.net##body:style(padding: 0;)')).toEqual(
            'example.com,~example.net##body:style(padding: 0;)',
        );
        expect(parseAndGenerate('#@#body:style(padding: 0;)')).toEqual('#@#body:style(padding: 0;)');
        expect(parseAndGenerate('example.com,~example.net#@#body:style(padding: 0;)')).toEqual(
            'example.com,~example.net#@#body:style(padding: 0;)',
        );

        // uBlock CSS injection with Extended CSS and media query
        expect(parseAndGenerate('##body:has(.ad):style(padding: 0;)')).toEqual('##body:has(.ad):style(padding: 0;)');
        expect(parseAndGenerate('example.com,~example.net##body:has(.ad):style(padding: 0;)')).toEqual(
            'example.com,~example.net##body:has(.ad):style(padding: 0;)',
        );
        expect(parseAndGenerate('#@#body:has(.ad):style(padding: 0;)')).toEqual('#@#body:has(.ad):style(padding: 0;)');
        expect(parseAndGenerate('example.com,~example.net#@#body:has(.ad):style(padding: 0;)')).toEqual(
            'example.com,~example.net#@#body:has(.ad):style(padding: 0;)',
        );

        expect(
            parseAndGenerate(
                '##body:has(.ad):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0;)',
            ),
        ).toEqual(
            '##body:has(.ad):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0;)',
        );
        expect(
            parseAndGenerate(
                'example.com,~example.net##body:has(.ad):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0;)',
            ),
        ).toEqual(
            'example.com,~example.net##body:has(.ad):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0;)',
        );
        expect(
            parseAndGenerate(
                '#@#body:has(.ad):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0;)',
            ),
        ).toEqual(
            '#@#body:has(.ad):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0;)',
        );
        expect(
            parseAndGenerate(
                'example.com,~example.net#@#body:has(.ad):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0;)',
            ),
        ).toEqual(
            'example.com,~example.net#@#body:has(.ad):matches-media((min-width: 1024px) and (max-width: 1920px)):style(padding: 0;)',
        );

        // AdGuard scriptlet injection
        expect(parseAndGenerate("#%#//scriptlet('scriptlet0', 'arg0', 'arg1')")).toEqual(
            "#%#//scriptlet('scriptlet0', 'arg0', 'arg1')",
        );
        expect(parseAndGenerate("example.com,~example.net#%#//scriptlet('scriptlet0', 'arg0', 'arg1')")).toEqual(
            "example.com,~example.net#%#//scriptlet('scriptlet0', 'arg0', 'arg1')",
        );
        expect(parseAndGenerate("#@%#//scriptlet('scriptlet0', 'arg0', 'arg1')")).toEqual(
            "#@%#//scriptlet('scriptlet0', 'arg0', 'arg1')",
        );
        expect(parseAndGenerate("example.com,~example.net#@%#//scriptlet('scriptlet0', 'arg0', 'arg1')")).toEqual(
            "example.com,~example.net#@%#//scriptlet('scriptlet0', 'arg0', 'arg1')",
        );

        // uBlock Origin scriptlet injection
        expect(parseAndGenerate('##+js(scriptlet0, arg0, arg1)')).toEqual('##+js(scriptlet0, arg0, arg1)');
        expect(parseAndGenerate('example.com,~example.net##+js(scriptlet0, arg0, arg1)')).toEqual(
            'example.com,~example.net##+js(scriptlet0, arg0, arg1)',
        );
        expect(parseAndGenerate('#@#+js(scriptlet0, arg0, arg1)')).toEqual('#@#+js(scriptlet0, arg0, arg1)');
        expect(parseAndGenerate('example.com,~example.net#@#+js(scriptlet0, arg0, arg1)')).toEqual(
            'example.com,~example.net#@#+js(scriptlet0, arg0, arg1)',
        );

        // Adblock Plus scriptlet injection
        expect(parseAndGenerate('#$#scriptlet0 arg0 arg1')).toEqual('#$#scriptlet0 arg0 arg1');
        expect(parseAndGenerate('example.com,~example.net#$#scriptlet0 arg0 arg1')).toEqual(
            'example.com,~example.net#$#scriptlet0 arg0 arg1',
        );
        expect(parseAndGenerate('#@$#scriptlet0 arg0 arg1')).toEqual('#@$#scriptlet0 arg0 arg1');
        expect(parseAndGenerate('example.com,~example.net#@$#scriptlet0 arg0 arg1')).toEqual(
            'example.com,~example.net#@$#scriptlet0 arg0 arg1',
        );
        expect(parseAndGenerate('#$#scriptlet0 arg0 arg1;')).toEqual('#$#scriptlet0 arg0 arg1');
        expect(parseAndGenerate('example.com,~example.net#$#scriptlet0 arg0 arg1;')).toEqual(
            'example.com,~example.net#$#scriptlet0 arg0 arg1',
        );
        expect(parseAndGenerate('#@$#scriptlet0 arg0 arg1;')).toEqual('#@$#scriptlet0 arg0 arg1');
        expect(parseAndGenerate('example.com,~example.net#@$#scriptlet0 arg0 arg1;')).toEqual(
            'example.com,~example.net#@$#scriptlet0 arg0 arg1',
        );

        // Multiple ABP snippets
        expect(parseAndGenerate('#$#scriptlet0 arg01 arg01; scriptlet1; scriptlet2 arg21')).toEqual(
            '#$#scriptlet0 arg01 arg01; scriptlet1; scriptlet2 arg21',
        );
        expect(
            parseAndGenerate('example.com,~example.net#$#scriptlet0 arg01 arg01; scriptlet1; scriptlet2 arg21'),
        ).toEqual('example.com,~example.net#$#scriptlet0 arg01 arg01; scriptlet1; scriptlet2 arg21');
        expect(parseAndGenerate('#@$#scriptlet0 arg01 arg01; scriptlet1; scriptlet2 arg21')).toEqual(
            '#@$#scriptlet0 arg01 arg01; scriptlet1; scriptlet2 arg21',
        );
        expect(
            parseAndGenerate('example.com,~example.net#@$#scriptlet0 arg01 arg01; scriptlet1; scriptlet2 arg21'),
        ).toEqual('example.com,~example.net#@$#scriptlet0 arg01 arg01; scriptlet1; scriptlet2 arg21');

        // AdGuard HTML filters
        expect(parseAndGenerate('$$script[tag-content="adblock"]')).toEqual('$$script[tag-content="adblock"]');
        expect(parseAndGenerate('example.com,~example.net$$script[tag-content="adblock"]')).toEqual(
            'example.com,~example.net$$script[tag-content="adblock"]',
        );
        expect(parseAndGenerate('$@$script[tag-content="adblock"]')).toEqual('$@$script[tag-content="adblock"]');
        expect(parseAndGenerate('example.com,~example.net$@$script[tag-content="adblock"]')).toEqual(
            'example.com,~example.net$@$script[tag-content="adblock"]',
        );

        // uBlock Origin HTML filters
        expect(parseAndGenerate('##^script:has-text(adblock)')).toEqual('##^script:has-text(adblock)');
        expect(parseAndGenerate('example.com,~example.net##^script:has-text(adblock)')).toEqual(
            'example.com,~example.net##^script:has-text(adblock)',
        );
        expect(parseAndGenerate('#@#^script:has-text(adblock)')).toEqual('#@#^script:has-text(adblock)');
        expect(parseAndGenerate('example.com,~example.net#@#^script:has-text(adblock)')).toEqual(
            'example.com,~example.net#@#^script:has-text(adblock)',
        );
        expect(parseAndGenerate('##^script:has-text(adblock), script:has-text(detector)')).toEqual(
            '##^script:has-text(adblock), script:has-text(detector)',
        );
        expect(
            parseAndGenerate('example.com,~example.net##^script:has-text(adblock), script:has-text(detector)'),
        ).toEqual('example.com,~example.net##^script:has-text(adblock), script:has-text(detector)');
        expect(parseAndGenerate('#@#^script:has-text(adblock), script:has-text(detector)')).toEqual(
            '#@#^script:has-text(adblock), script:has-text(detector)',
        );
        expect(
            parseAndGenerate('example.com,~example.net#@#^script:has-text(adblock), script:has-text(detector)'),
        ).toEqual('example.com,~example.net#@#^script:has-text(adblock), script:has-text(detector)');

        // AdGuard JS injections
        expect(parseAndGenerate('#%#const a = 2;')).toEqual('#%#const a = 2;');
        expect(parseAndGenerate('example.com,~example.net#%#const a = 2;')).toEqual(
            'example.com,~example.net#%#const a = 2;',
        );
        expect(parseAndGenerate('#@%#const a = 2;')).toEqual('#@%#const a = 2;');
        expect(parseAndGenerate('example.com,~example.net#@%#const a = 2;')).toEqual(
            'example.com,~example.net#@%#const a = 2;',
        );

        // AdGuard modifiers/options
        expect(parseAndGenerate('[$app=com.something]#%#const a = 2;')).toEqual('[$app=com.something]#%#const a = 2;');
        expect(parseAndGenerate('[$app=com.something,anything=123]#%#const a = 2;')).toEqual(
            '[$app=com.something,anything=123]#%#const a = 2;',
        );
        expect(parseAndGenerate('[$app=com.something,anything=123]example.com,~example.net#%#const a = 2;')).toEqual(
            '[$app=com.something,anything=123]example.com,~example.net#%#const a = 2;',
        );
    });
});
