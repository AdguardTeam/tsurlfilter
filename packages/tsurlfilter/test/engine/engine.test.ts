import { type AnyRule, RuleGenerator } from '@adguard/agtree';
import escapeStringRegexp from 'escape-string-regexp';
import { describe, expect, it } from 'vitest';

import { config, setConfiguration } from '../../src/configuration';
import { CosmeticOption } from '../../src/engine/cosmetic-option';
import { Engine } from '../../src/engine/engine';
import { BufferRuleList } from '../../src/filterlist/buffer-rule-list';
import { FilterListPreprocessor, type PreprocessedFilterList } from '../../src/filterlist/preprocessor';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { getRuleSourceIndex } from '../../src/filterlist/source-map';
import { Request } from '../../src/request';
import { RequestType } from '../../src/request-type';
import { createCosmeticRule, createNetworkRule } from '../helpers/rule-creator';

const createRequest = (url: string): Request => new Request(url, null, RequestType.Document);

/**
 * Helper function to get the rule index from the raw filter list by the rule text.
 *
 * @param rawFilterList Raw filter list.
 * @param rule Rule text.
 *
 * @returns Rule index or -1 if the rule couldn't be found.
 */
const getRawRuleIndex = (rawFilterList: string, rule: string): number => {
    return rawFilterList.search(new RegExp(`^${escapeStringRegexp(rule)}$`, 'm'));
};

describe('Engine Tests', () => {
    it('works if request matches rule', () => {
        const rules = ['||example.org^$third-party'];
        const list = new BufferRuleList(1, FilterListPreprocessor.preprocess(rules.join('\n')).filterList, false);
        const engine = new Engine(new RuleStorage([list]));

        expect(engine.getRulesCount()).toBe(1);

        let request = new Request('https://example.org', '', RequestType.Document);
        let result = engine.matchRequest(request);

        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeNull();
        expect(result.replaceRules).toBeNull();
        expect(result.cspRules).toBeNull();
        expect(result.cookieRules).toBeNull();
        expect(result.stealthRules).toBeNull();

        request = new Request('https://example.org', 'https://example.org', RequestType.Document);
        result = engine.matchRequest(request);

        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeNull();
        expect(result.replaceRules).toBeNull();
        expect(result.cspRules).toBeNull();
        expect(result.cookieRules).toBeNull();
        expect(result.stealthRules).toBeNull();
    });

    it('works if frame matches rule', () => {
        const ruleText = '@@||example.org$document';
        const rules = [ruleText];
        const list = new BufferRuleList(1, FilterListPreprocessor.preprocess(rules.join('\n')).filterList, false);
        const engine = new Engine(new RuleStorage([list]));

        expect(engine.getRulesCount()).toBe(1);

        const request = new Request('https://example.org', '', RequestType.Document);
        const result = engine.matchRequest(request);

        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule).toMatchNetworkRule(createNetworkRule(ruleText));
        expect(result.documentRule).toBeNull();

        let frameRule = engine.matchFrame('https://example.org');
        expect(frameRule).not.toBeNull();
        expect(frameRule).toMatchNetworkRule(createNetworkRule(ruleText));

        frameRule = engine.matchFrame('https://test.com');
        expect(frameRule).toBeNull();
    });

    it('retrieveRuleNode', () => {
        const list1 = FilterListPreprocessor.preprocess([
            '||example.org^$third-party',
            '##banner',
        ].join('\n'));

        const list2 = FilterListPreprocessor.preprocess([
            "#%#//scriptlet('set-constant', 'foo', 'bar')",
            '#@#.yay',
        ].join('\n'));

        const engine = new Engine(new RuleStorage([
            new BufferRuleList(1, list1.filterList, false),
            new BufferRuleList(2, list2.filterList, false),
        ]));

        expect(engine.getRulesCount()).toBe(4);

        /**
         * Helper function to get the rule index from the source map by the rule number.
         *
         * @param rule Rule number, starting from 1.
         * @param sourceMap Source map.
         *
         * @returns Rule index.
         *
         * @throws Error if the rule is not found.
         */
        const getRuleIndex = (rule: number, sourceMap: PreprocessedFilterList['sourceMap']): number => {
            const ruleIndex = Object.keys(sourceMap)[rule - 1];

            if (ruleIndex === undefined) {
                throw new Error(`Rule with number ${rule} not found in source map`);
            }

            return parseInt(ruleIndex, 10);
        };

        // List 1
        let node: AnyRule | null = engine.retrieveRuleNode(1, getRuleIndex(1, list1.sourceMap));
        expect(node).not.toBeNull();
        expect(RuleGenerator.generate(node!)).toStrictEqual('||example.org^$third-party');

        node = engine.retrieveRuleNode(1, getRuleIndex(2, list1.sourceMap));
        expect(node).not.toBeNull();
        expect(RuleGenerator.generate(node!)).toStrictEqual('##banner');

        // List 2
        node = engine.retrieveRuleNode(2, getRuleIndex(1, list2.sourceMap));
        expect(node).not.toBeNull();
        expect(RuleGenerator.generate(node!)).toStrictEqual("#%#//scriptlet('set-constant', 'foo', 'bar')");

        node = engine.retrieveRuleNode(2, getRuleIndex(2, list2.sourceMap));
        expect(node).not.toBeNull();
        expect(RuleGenerator.generate(node!)).toStrictEqual('#@#.yay');

        // Should return null if the rule is not found, e.g. wrong filterId or ruleIndex
        node = engine.retrieveRuleNode(1, getRuleIndex(1, list1.sourceMap) + 1);
        expect(node).toBeNull();

        node = engine.retrieveRuleNode(2000, 4);
        expect(node).toBeNull();
    });
});

describe('TestEngine - postponed load rules', () => {
    const rules = ['||example.org^$third-party', 'example.org##banner'];
    const processed = FilterListPreprocessor.preprocess(rules.join('\n'));
    const list = new BufferRuleList(1, processed.filterList, false, false, false, processed.sourceMap);
    const ruleStorage = new RuleStorage([list]);

    it('works rules are loaded', () => {
        const engine = new Engine(ruleStorage, true);

        expect(engine.getRulesCount()).toBe(0);

        engine.loadRules();

        expect(engine.getRulesCount()).toBe(2);
    });

    it('works rules are loaded async', async () => {
        const engine = new Engine(ruleStorage, true);

        expect(engine.getRulesCount()).toBe(0);

        await engine.loadRulesAsync(1);

        expect(engine.getRulesCount()).toBe(2);
    });
});

it('TestEngine - configuration', () => {
    const rules = ['||example.org^$third-party'];
    const processed = FilterListPreprocessor.preprocess(rules.join('\n'));
    const list = new BufferRuleList(1, processed.filterList, false, false, false, processed.sourceMap);
    setConfiguration({
        engine: 'test-engine',
        version: 'test-version',
        verbose: true,
    });

    new Engine(new RuleStorage([list]));

    expect(config.engine).toBe('test-engine');
    expect(config.version).toBe('test-version');
    expect(config.verbose).toBe(true);
});

describe('TestEngineMatchRequest - advanced modifiers', () => {
    it('works if advanced modifier rules are found', () => {
        const cspRule = '||example.org^$csp=frame-src \'none\'';
        const replaceRule = '||example.org^$replace=/text-to-be-replaced/new-text/i';
        const cookieRule = '||example.org^$cookie';
        const removeParamRule = '||example.org^$removeparam=p1';
        const rules = [cspRule, replaceRule, cookieRule, removeParamRule];
        const preprocessed = FilterListPreprocessor.preprocess(rules.join('\n'));

        const list = new BufferRuleList(1, preprocessed.filterList, false, false, false, preprocessed.sourceMap);
        const engine = new Engine(new RuleStorage([list]));

        const request = new Request('https://example.org', '', RequestType.Document);
        const result = engine.matchRequest(request);

        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeNull();
        expect(result.replaceRules?.length).toBe(1);
        expect(result.replaceRules?.[0]).toMatchNetworkRule(createNetworkRule(replaceRule));
        expect(result.cspRules?.length).toBe(1);
        expect(result.cspRules?.[0]).toMatchNetworkRule(createNetworkRule(cspRule));
        expect(result.cookieRules?.length).toBe(1);
        expect(result.cookieRules?.[0]).toMatchNetworkRule(createNetworkRule(cookieRule));
        expect(result.removeParamRules?.length).toBe(1);
        expect(result.removeParamRules?.[0]).toMatchNetworkRule(createNetworkRule(removeParamRule));
        expect(result.stealthRules).toBeNull();
    });

    it('it excludes allowlist rules, even if there are two badfilter rules', () => {
        const redirectRule = '/fuckadblock.$script,redirect=prevent-fab-3.2.0';
        const allowlistRule = '@@/fuckadblock.min.js$domain=example.org';
        const allowlistBadfilterRule = '@@/fuckadblock.min.js$domain=example.org,badfilter';
        const badfilterRule = '/fuckadblock.min.js$badfilter';

        const preprocessed = FilterListPreprocessor.preprocess(
            [
                redirectRule,
                allowlistRule,
                badfilterRule,
                allowlistBadfilterRule,
            ].join('\n'),
        );

        const baseRuleList = new BufferRuleList(
            1,
            preprocessed.filterList,
            false,
            false,
            false,
            preprocessed.sourceMap,
        );
        const engine = new Engine(new RuleStorage([baseRuleList]));

        const request = new Request(
            'https://example.org/fuckadblock.min.js',
            'https://example.org/url.html',
            RequestType.Script,
        );
        const result = engine.matchRequest(request);

        expect(result.getBasicResult()).toMatchNetworkRule(createNetworkRule(redirectRule));
        expect(result.getDocumentBlockingResult()).toBeNull();
    });
});

describe('TestEngineMatchRequest - redirect modifier', () => {
    it('checks if with redirect modifier resource type is not ignored', () => {
        const baseRuleList = new BufferRuleList(1, FilterListPreprocessor.preprocess([
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=1x1-transparent.gif',
            '@@||ya.ru$redirect=1x1-transparent.gif',
        ].join('\n')).filterList);

        const engine = new Engine(new RuleStorage([baseRuleList]));

        const request = new Request(
            'http://ya.ru/',
            null,
            RequestType.Image,
        );
        const result = engine.matchRequest(request);

        expect(result.getBasicResult()).toBeNull();
        expect(result.getDocumentBlockingResult()).toBeNull();
    });

    it('checks if with allowlist redirect modifier resource type is not ignored', () => {
        const baseRuleList = new BufferRuleList(1, FilterListPreprocessor.preprocess([
            '||ya.ru$redirect=1x1-transparent.gif',
            '@@||ya.ru$redirect=1x1-transparent.gif,image',
        ].join('\n')).filterList);

        const engine = new Engine(new RuleStorage([baseRuleList]));

        let request = new Request(
            'http://ya.ru/',
            null,
            RequestType.Image,
        );
        expect(engine.matchRequest(request).getBasicResult()).toBeNull();

        request = new Request(
            'http://ya.ru/',
            null,
            RequestType.Media,
        );
        expect(engine.matchRequest(request).getBasicResult()).not.toBeNull();
    });

    it('checks that unrelated exception does not exclude other blocking rules', () => {
        const baseRuleList = new BufferRuleList(1, FilterListPreprocessor.preprocess([
            '||ya.ru$redirect=1x1-transparent.gif',
            '@@||ya.ru$redirect=2x2-transparent.png',
        ].join('\n')).filterList);

        const engine = new Engine(new RuleStorage([baseRuleList]));

        const request = new Request(
            'http://ya.ru/',
            null,
            RequestType.Image,
        );
        const basicResult = engine.matchRequest(request).getBasicResult();
        expect(basicResult).not.toBeNull();
        expect(basicResult).toMatchNetworkRule(createNetworkRule('||ya.ru$redirect=1x1-transparent.gif'));
    });

    it('checks that it is possible to exclude all redirects with `@@$redirect` rule', () => {
        const baseRuleList = new BufferRuleList(1, FilterListPreprocessor.preprocess([
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=1x1-transparent.gif',
            '||ya.ru$redirect=2x2-transparent.png',
            '@@||ya.ru$redirect',
        ].join('\n')).filterList);

        const engine = new Engine(new RuleStorage([baseRuleList]));

        let request = new Request(
            'http://ya.ru/',
            null,
            RequestType.Image,
        );
        expect(engine.matchRequest(request).getBasicResult()).toBeNull();

        request = new Request(
            'http://ya.ru/',
            null,
            RequestType.Media,
        );
        expect(engine.matchRequest(request).getBasicResult()).toBeNull();
    });

    it('checks that it is possible to exclude all redirects with `@@$redirect` rule - resource type', () => {
        const baseRuleList = new BufferRuleList(1, FilterListPreprocessor.preprocess([
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=1x1-transparent.gif',
            '||ya.ru$redirect=2x2-transparent.png',
            '@@||ya.ru$redirect,image',
        ].join('\n')).filterList);

        const engine = new Engine(new RuleStorage([baseRuleList]));

        let request = new Request(
            'http://ya.ru/',
            null,
            RequestType.Image,
        );
        expect(engine.matchRequest(request).getBasicResult()).toBeNull();

        request = new Request(
            'http://ya.ru/',
            null,
            RequestType.Media,
        );
        expect(engine.matchRequest(request).getBasicResult()).not.toBeNull();
    });
});

describe('TestEngineMatchRequest - redirect-rule modifier', () => {
    it('checks if redirect-rule is found for blocked requests only', () => {
        const baseRuleList = new BufferRuleList(1, FilterListPreprocessor.preprocess([
            '||example.org/script.js',
            '||example.org^$redirect-rule=noopjs',
        ].join('\n')).filterList);

        const engine = new Engine(new RuleStorage([baseRuleList]));

        let request = new Request(
            'https://example.org/script.js',
            null,
            RequestType.Script,
        );
        let result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(result.getBasicResult()).toMatchNetworkRule(createNetworkRule('||example.org^$redirect-rule=noopjs'));

        request = new Request(
            'https://example.org/index.js',
            null,
            RequestType.Script,
        );
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).toBeNull();
    });

    it('checks if redirect-rule is negated by allowlist $redirect rule', () => {
        const rules = [
            '||example.org/script.js',
            '||example.org^$redirect-rule=noopjs',
            '@@||example.org/script.js?unblock$redirect',
        ];
        const processed = FilterListPreprocessor.preprocess(rules.join('\n'));
        const baseRuleList = new BufferRuleList(1, processed.filterList, false, false, false, processed.sourceMap);

        const engine = new Engine(new RuleStorage([baseRuleList]));

        let request = new Request(
            'https://example.org/script.js',
            null,
            RequestType.Script,
        );
        let result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(
            getRawRuleIndex(processed.rawFilterList, rules[1]),
        ).toBe(
            getRuleSourceIndex(result.getBasicResult()!.getIndex(), processed.sourceMap),
        );

        request = new Request(
            'https://example.org/index.js',
            null,
            RequestType.Script,
        );
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).toBeNull();

        request = new Request(
            'https://example.org/script.js?unblock',
            null,
            RequestType.Script,
        );
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(
            getRawRuleIndex(processed.rawFilterList, rules[0]),
        ).toBe(
            getRuleSourceIndex(result.getBasicResult()!.getIndex(), processed.sourceMap),
        );
    });
});

describe('TestEngineMatchRequest - document modifier', () => {
    it('respects document modifier request type in blocking rules', () => {
        const documentBlockingRuleText = '||example.org^$document';
        const baseRuleList = new BufferRuleList(1, FilterListPreprocessor.preprocess([
            documentBlockingRuleText,
        ].join('\n')).filterList);

        const engine = new Engine(new RuleStorage([baseRuleList]));

        let request = new Request('http://example.org/', null, RequestType.Document);
        let result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(result.getBasicResult()).toMatchNetworkRule(createNetworkRule(documentBlockingRuleText));
        expect(result.getDocumentBlockingResult()).not.toBeNull();
        expect(result.getDocumentBlockingResult()).toMatchNetworkRule(createNetworkRule(documentBlockingRuleText));

        request = new Request('http://other.org/', null, RequestType.Document);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).toBeNull();
        expect(result.getDocumentBlockingResult()).toBeNull();

        request = new Request('http://example.org/', null, RequestType.Image);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).toBeNull();
        expect(result.getDocumentBlockingResult()).toBeNull();
    });

    it('respects document modifier request type in blocking rules - other request types', () => {
        const documentBlockingRuleText = '||example.org^$document,script';
        const baseRuleList = new BufferRuleList(1, FilterListPreprocessor.preprocess([
            documentBlockingRuleText,
        ].join('\n')).filterList);

        const engine = new Engine(new RuleStorage([baseRuleList]));

        let request = new Request('http://example.org/', null, RequestType.Document);
        let result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(result.getBasicResult()).toMatchNetworkRule(createNetworkRule(documentBlockingRuleText));
        expect(result.getDocumentBlockingResult()).not.toBeNull();
        expect(result.getDocumentBlockingResult()).toMatchNetworkRule(createNetworkRule(documentBlockingRuleText));

        request = new Request('http://example.org/', null, RequestType.Script);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(result.getBasicResult()).toMatchNetworkRule(createNetworkRule(documentBlockingRuleText));
        expect(result.getDocumentBlockingResult()).not.toBeNull();
        expect(result.getDocumentBlockingResult()).toMatchNetworkRule(createNetworkRule(documentBlockingRuleText));

        request = new Request('http://example.org/', null, RequestType.Image);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).toBeNull();
        expect(result.getDocumentBlockingResult()).toBeNull();
    });
});

describe('TestEngineMatchRequest - all modifier', () => {
    it('respects $all modifier with all request types in blocking rules', () => {
        const allBlockingRuleText = '||example.org^$all';
        const baseRuleList = new BufferRuleList(1, FilterListPreprocessor.preprocess([
            allBlockingRuleText,
        ].join('\n')).filterList);

        const engine = new Engine(new RuleStorage([baseRuleList]));

        let request = new Request('http://example.org/', null, RequestType.Document);
        let result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(result.getBasicResult()).toMatchNetworkRule(createNetworkRule(allBlockingRuleText));
        expect(result.getDocumentBlockingResult()).not.toBeNull();
        expect(result.getDocumentBlockingResult()).toMatchNetworkRule(createNetworkRule(allBlockingRuleText));

        request = new Request('http://other.org/', null, RequestType.Document);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).toBeNull();
        expect(result.getDocumentBlockingResult()).toBeNull();

        request = new Request('http://example.org/', null, RequestType.Image);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).toMatchNetworkRule(createNetworkRule(allBlockingRuleText));
        expect(result.getDocumentBlockingResult()).toMatchNetworkRule(createNetworkRule(allBlockingRuleText));
    });
});

describe('TestEngineMatchRequest - popup modifier', () => {
    it('match requests against basic and popup blocking rules', () => {
        const blockingRuleText = '||example.org^';
        const popupBlockingRuleText = '||example.org^$popup';
        const baseRuleList = new BufferRuleList(1, FilterListPreprocessor.preprocess([
            blockingRuleText,
            popupBlockingRuleText,
        ].join('\n')).filterList);

        const engine = new Engine(new RuleStorage([baseRuleList]));

        // Tests matching an XMLHttpRequest; expects to match the basic blocking rule
        let request = new Request('http://example.org/', 'http://example.com/', RequestType.XmlHttpRequest);
        let result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(result.getBasicResult()).toMatchNetworkRule(createNetworkRule(blockingRuleText));
        expect(result.getPopupRule()).toMatchNetworkRule(createNetworkRule(popupBlockingRuleText));
        expect(result.getDocumentBlockingResult()).toBeNull();

        // Tests matching a script request; expects to match the basic blocking rule
        request = new Request('http://example.org/', 'http://example.com/', RequestType.Script);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(result.getBasicResult()).toMatchNetworkRule(createNetworkRule(blockingRuleText));
        expect(result.getPopupRule()).toMatchNetworkRule(createNetworkRule(popupBlockingRuleText));
        expect(result.getDocumentBlockingResult()).toBeNull();

        // Tests matching an image request; expects to match the basic blocking rule
        request = new Request('http://example.org/', 'http://example.com/', RequestType.Image);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(result.getBasicResult()).toMatchNetworkRule(createNetworkRule(blockingRuleText));
        expect(result.getPopupRule()).toMatchNetworkRule(createNetworkRule(popupBlockingRuleText));
        expect(result.getDocumentBlockingResult()).toBeNull();

        // Tests matching a document request; expects to match the popup blocking rule
        request = new Request('http://example.org/', 'http://example.com/', RequestType.Document);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(result.getBasicResult()).toMatchNetworkRule(createNetworkRule(blockingRuleText));
        expect(result.getPopupRule()).toMatchNetworkRule(createNetworkRule(popupBlockingRuleText));
        expect(result.getDocumentBlockingResult()).toBeNull();
    });

    it('match requests against all and popup blocking rules', () => {
        const blockingAllRuleText = '||example.org^$all';
        const popupBlockingRuleText = '||example.org^$popup';
        const baseRuleList = new BufferRuleList(1, FilterListPreprocessor.preprocess([
            blockingAllRuleText,
            popupBlockingRuleText,
        ].join('\n')).filterList);

        const engine = new Engine(new RuleStorage([baseRuleList]));

        // Tests matching an XMLHttpRequest; expects to match the all-encompassing blocking rule
        let request = new Request('http://example.org/', 'http://example.com/', RequestType.XmlHttpRequest);
        let result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(result.getBasicResult()).toMatchNetworkRule(createNetworkRule(blockingAllRuleText));
        expect(result.getPopupRule()).toMatchNetworkRule(createNetworkRule(popupBlockingRuleText));
        expect(result.getDocumentBlockingResult()).not.toBeNull();
        expect(result.getDocumentBlockingResult()).toMatchNetworkRule(createNetworkRule(blockingAllRuleText));

        // Tests matching a script request; expects to match the all-encompassing blocking rule
        request = new Request('http://example.org/', 'http://example.com/', RequestType.Script);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(result.getBasicResult()).toMatchNetworkRule(createNetworkRule(blockingAllRuleText));
        expect(result.getPopupRule()).toMatchNetworkRule(createNetworkRule(popupBlockingRuleText));
        expect(result.getDocumentBlockingResult()).not.toBeNull();
        expect(result.getDocumentBlockingResult()).toMatchNetworkRule(createNetworkRule(blockingAllRuleText));

        // Tests matching an image request; expects to match the all-encompassing blocking rule
        request = new Request('http://example.org/', 'http://example.com/', RequestType.Image);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(result.getBasicResult()).toMatchNetworkRule(createNetworkRule(blockingAllRuleText));
        expect(result.getPopupRule()).toMatchNetworkRule(createNetworkRule(popupBlockingRuleText));
        expect(result.getDocumentBlockingResult()).not.toBeNull();
        expect(result.getDocumentBlockingResult()).toMatchNetworkRule(createNetworkRule(blockingAllRuleText));

        // Tests matching a document request; expects to match the popup blocking rule
        request = new Request('http://example.org/', 'http://example.com/', RequestType.Document);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(result.getBasicResult()).toMatchNetworkRule(createNetworkRule(blockingAllRuleText));
        expect(result.getPopupRule()).toMatchNetworkRule(createNetworkRule(popupBlockingRuleText));
        expect(result.getDocumentBlockingResult()).not.toBeNull();
        expect(result.getDocumentBlockingResult()).toMatchNetworkRule(createNetworkRule(blockingAllRuleText));
    });
});

describe('TestEngineCosmeticResult - elemhide', () => {
    const specificRuleContent = 'banner_specific';
    const specificRule = `example.org##${specificRuleContent}`;

    const genericRuleContent = 'banner_generic';
    const genericRule = `##${genericRuleContent}`;

    const genericDisabledRuleContent = 'banner_generic_disabled';
    const genericDisabledRule = `##${genericDisabledRuleContent}`;
    const specificDisablingRule = `example.org#@#${genericDisabledRuleContent}`;

    const extCssSpecificRuleText = '.ext_css_specific[-ext-contains=test]';
    const extCssSpecificRule = `example.org##${extCssSpecificRuleText}`;
    const extCssGenericRuleText = '.ext_css_generic[-ext-contains=test]';
    const extCssGenericRule = `##${extCssGenericRuleText}`;

    const rules = [
        specificRule,
        specificDisablingRule,
        genericRule,
        genericDisabledRule,
        extCssSpecificRule,
        extCssGenericRule,
    ];

    const list = new BufferRuleList(1, FilterListPreprocessor.preprocess(rules.join('\n')).filterList, false);
    const engine = new Engine(new RuleStorage([list]));

    it('works if returns correct cosmetic elemhide result', () => {
        let result = engine.getCosmeticResult(createRequest('https://an-other-domain.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.elementHiding.generic.length).toEqual(2);
        expect(result.elementHiding.specific.length).toEqual(0);
        expect(result.elementHiding.genericExtCss.length).toBe(1);
        expect(result.elementHiding.specificExtCss.length).toBe(0);

        result = engine.getCosmeticResult(createRequest('http://example.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.elementHiding.generic.length).toEqual(1);
        expect(result.elementHiding.specific.length).toEqual(1);
        expect(result.elementHiding.genericExtCss.length).toBe(1);
        expect(result.elementHiding.specificExtCss.length).toBe(1);

        result = engine.getCosmeticResult(
            createRequest('http://example.org'),
            CosmeticOption.CosmeticOptionGenericCSS & CosmeticOption.CosmeticOptionSpecificCSS,
        );

        expect(result.elementHiding.generic.length).toEqual(0);
        expect(result.elementHiding.specific.length).toEqual(0);
        expect(result.elementHiding.genericExtCss.length).toBe(0);
        expect(result.elementHiding.specificExtCss.length).toBe(0);

        result = engine.getCosmeticResult(
            createRequest('http://example.org'),
            CosmeticOption.CosmeticOptionGenericCSS
            | CosmeticOption.CosmeticOptionSpecificCSS,
        );

        expect(result.elementHiding.generic.length).toEqual(1);
        expect(result.elementHiding.specific.length).toEqual(1);
        expect(result.elementHiding.genericExtCss.length).toBe(1);
        expect(result.elementHiding.specificExtCss.length).toBe(1);
    });
});

describe('TestEngineCosmeticResult - cosmetic css', () => {
    const cssRuleText = '.cosmetic { visibility: hidden; }';
    const specificCssRule = `example.org#$#${cssRuleText}`;
    const genericCssRule = `#$#${cssRuleText}`;
    const extCssCssRuleText = ':upward(.ext-css-cosmetic) { visibility: hidden; }';
    const extCssSpecificCssRule = `example.org#$#${extCssCssRuleText}`;
    const extCssGenericCssRule = `#$#${extCssCssRuleText}`;

    const rules = [
        specificCssRule,
        genericCssRule,
        extCssSpecificCssRule,
        extCssGenericCssRule,
    ];

    const list = new BufferRuleList(1, FilterListPreprocessor.preprocess(rules.join('\n')).filterList, false);
    const engine = new Engine(new RuleStorage([list]));

    it('works if returns correct cosmetic css result', () => {
        let result = engine.getCosmeticResult(createRequest('https://an-other-domain.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.CSS.generic.length).toEqual(1);
        expect(result.CSS.specific.length).toEqual(0);
        expect(result.CSS.genericExtCss.length).toBe(1);
        expect(result.CSS.specificExtCss.length).toBe(0);

        result = engine.getCosmeticResult(createRequest('http://example.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.CSS.generic.length).toEqual(1);
        expect(result.CSS.specific.length).toEqual(1);
        expect(result.CSS.genericExtCss.length).toBe(1);
        expect(result.CSS.specificExtCss.length).toBe(1);

        result = engine.getCosmeticResult(
            createRequest('http://example.org'),
            CosmeticOption.CosmeticOptionSpecificCSS & CosmeticOption.CosmeticOptionGenericCSS,
        );

        expect(result.CSS.generic.length).toEqual(0);
        expect(result.CSS.specific.length).toEqual(0);
        expect(result.CSS.genericExtCss.length).toBe(0);
        expect(result.CSS.specificExtCss.length).toBe(0);

        result = engine.getCosmeticResult(
            createRequest('http://example.org'),
            CosmeticOption.CosmeticOptionGenericCSS | CosmeticOption.CosmeticOptionSpecificCSS,
        );

        expect(result.CSS.generic.length).toEqual(1);
        expect(result.CSS.specific.length).toEqual(1);
        expect(result.CSS.genericExtCss.length).toBe(1);
        expect(result.CSS.specificExtCss.length).toBe(1);
    });
});

describe('TestEngineCosmeticResult - js', () => {
    const jsRuleText = 'window.__gaq = undefined;';
    const specificJsRule = `example.org#%#${jsRuleText}`;
    const genericJsRule = `#%#${jsRuleText}`;

    const rules = [
        specificJsRule,
        genericJsRule,
    ];

    // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2650
    it('matches wildcard cosmetic rules with private domains (com.ru)', () => {
        const hidingRule = 'flightradar24.*##body';
        const jsRule = 'flightradar24.*#%#alert(1);';
        const rawFilterList = [hidingRule, jsRule].join('\n');
        const preprocessed = FilterListPreprocessor.preprocess(rawFilterList);
        const list = new BufferRuleList(1, preprocessed.filterList, false, false, false, preprocessed.sourceMap);
        const engine = new Engine(new RuleStorage([list]));
        const result = engine.getCosmeticResult(
            createRequest('https://flightradar24.com.ru/faq/'),
            CosmeticOption.CosmeticOptionAll,
        );

        expect(result.JS.specific.length).toEqual(1);
        expect(
            getRawRuleIndex(preprocessed.rawFilterList, jsRule),
        ).toBe(
            getRuleSourceIndex(result.JS.specific[0].getIndex(), preprocessed.sourceMap),
        );

        expect(result.elementHiding.specific.length).toEqual(1);
        expect(
            getRawRuleIndex(preprocessed.rawFilterList, hidingRule),
        ).toBe(
            getRuleSourceIndex(result.elementHiding.specific[0].getIndex(), preprocessed.sourceMap),
        );
    });

    it('works if returns correct cosmetic js result', () => {
        const list = new BufferRuleList(1, FilterListPreprocessor.preprocess(rules.join('\n')).filterList, false);
        const engine = new Engine(new RuleStorage([list]));

        let result = engine.getCosmeticResult(createRequest('https://an-other-domain.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.JS.generic.length).toEqual(1);
        expect(result.JS.specific.length).toEqual(0);

        result = engine.getCosmeticResult(createRequest('http://example.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.JS.generic.length).toEqual(1);
        expect(result.JS.specific.length).toEqual(1);

        result = engine.getCosmeticResult(createRequest('http://example.org'), CosmeticOption.CosmeticOptionJS);

        expect(result.JS.generic.length).toEqual(1);
        expect(result.JS.specific.length).toEqual(1);
    });

    it('works javascript rules are ignored with filter list setting', () => {
        const list = new BufferRuleList(1, FilterListPreprocessor.preprocess(rules.join('\n')).filterList, false, true);
        const engine = new Engine(new RuleStorage([list]));

        let result = engine.getCosmeticResult(createRequest('https://an-other-domain.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.JS.generic.length).toEqual(0);
        expect(result.JS.specific.length).toEqual(0);

        result = engine.getCosmeticResult(createRequest('http://example.org'), CosmeticOption.CosmeticOptionAll);

        expect(result.JS.generic.length).toEqual(0);
        expect(result.JS.specific.length).toEqual(0);

        result = engine.getCosmeticResult(createRequest('http://example.org'), CosmeticOption.CosmeticOptionJS);

        expect(result.JS.generic.length).toEqual(0);
        expect(result.JS.specific.length).toEqual(0);
    });
});

describe('$urlblock modifier', () => {
    it('should not have higher priority than important', () => {
        const important = '||example.com$important';
        const urlblock = '@@||example.org$urlblock';

        const list = new BufferRuleList(
            1,
            FilterListPreprocessor.preprocess([important, urlblock].join('\n')).filterList,
        );
        const engine = new Engine(new RuleStorage([list]));

        const frameRule = engine.matchFrame('http://example.org');
        expect(frameRule).not.toBeNull();
        expect(frameRule).toMatchNetworkRule(createNetworkRule(urlblock));

        const request = new Request('http://example.com/image.png', 'http://example.org', RequestType.Image);
        const matchingResult = engine.matchRequest(request, frameRule);
        const basicResult = matchingResult.getBasicResult();
        expect(basicResult).toBeTruthy();
        expect(basicResult).toMatchNetworkRule(createNetworkRule(important));
        expect(basicResult).not.toBeNull();
        expect(matchingResult.getDocumentBlockingResult()).toBeNull();
    });
});

describe('$badfilter modifier', () => {
    it('checks badfilter rule negates network rule', () => {
        const rules = [
            '$script,domain=example.com|example.org',
            '$script,domain=example.com,badfilter',
        ];
        const list = new BufferRuleList(1, FilterListPreprocessor.preprocess(rules.join('\n')).filterList, false);
        const engine = new Engine(new RuleStorage([list]));

        expect(engine.getRulesCount()).toBe(2);

        let request = new Request('https://example.com', 'https://example.com', RequestType.Script);
        let result = engine.matchRequest(request);
        expect(result.basicRule).toBeNull();

        request = new Request('https://example.org', 'https://example.org', RequestType.Script);
        result = engine.matchRequest(request);
        expect(result.basicRule).not.toBeNull();
    });
});

describe('$genericblock modifier', () => {
    it('disables network generic rules', () => {
        const genericblockRule = '@@||domain.com^$genericblock';
        const networkGenericRule = '||example.org^';
        const networkNegatedGenericRule = '||domain.com^$domain=~example.com';

        const list = new BufferRuleList(1, FilterListPreprocessor.preprocess([
            networkGenericRule,
            networkNegatedGenericRule,
            genericblockRule,
        ].join('\n')).filterList);

        const engine = new Engine(new RuleStorage([list]));

        const frameRule = engine.matchFrame('https://domain.com');
        expect(frameRule).not.toBeNull();
        expect(frameRule).toMatchNetworkRule(createNetworkRule(genericblockRule));

        const result = engine.matchRequest(new Request(
            'https://example.org',
            'https://domain.com',
            RequestType.Script,
        ), frameRule);

        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toMatchNetworkRule(createNetworkRule(genericblockRule));
    });
});

describe('Match subdomains', () => {
    it('should find css rules for subdomains', () => {
        const specificHidingRule = 'example.org##div';
        const specificHidingRuleSubdomain = 'sub.example.org##h1';
        const rules = [
            specificHidingRule,
            specificHidingRuleSubdomain,
        ];
        const preprocessed = FilterListPreprocessor.preprocess(rules.join('\n'));
        const list = new BufferRuleList(1, preprocessed.filterList, false, false, false, preprocessed.sourceMap);
        const engine = new Engine(new RuleStorage([list]));

        let res = engine.getCosmeticResult(createRequest('https://www.example.org/'), CosmeticOption.CosmeticOptionAll);
        expect(res).toBeDefined();

        expect(res.elementHiding.specific).toHaveLength(1);
        expect(
            getRawRuleIndex(preprocessed.rawFilterList, specificHidingRule),
        ).toBe(
            getRuleSourceIndex(res.elementHiding.specific[0].getIndex(), preprocessed.sourceMap),
        );

        res = engine.getCosmeticResult(createRequest('https://sub.example.org'), CosmeticOption.CosmeticOptionAll);
        expect(res).toBeDefined();
        expect(res.elementHiding.specific).toHaveLength(2);

        expect(
            res.elementHiding.specific.map((rule) => getRuleSourceIndex(rule.getIndex(), preprocessed.sourceMap)),
        ).toContain(
            getRawRuleIndex(preprocessed.rawFilterList, specificHidingRule),
        );

        expect(
            res.elementHiding.specific.map((rule) => getRuleSourceIndex(rule.getIndex(), preprocessed.sourceMap)),
        ).toContain(
            getRawRuleIndex(preprocessed.rawFilterList, specificHidingRuleSubdomain),
        );
    });

    it('should find css rules with www only for domains with www', () => {
        const specificHidingRuleWithWww = 'www.i.ua###Premium';
        const specificHidingRuleWithoutWww = 'i.ua###Premium';
        const rules = [
            specificHidingRuleWithWww,
            specificHidingRuleWithoutWww,
        ];
        const preprocessed = FilterListPreprocessor.preprocess(rules.join('\n'));
        const list = new BufferRuleList(1, preprocessed.filterList, false, false, false, preprocessed.sourceMap);
        const engine = new Engine(new RuleStorage([list]));

        let res = engine.getCosmeticResult(createRequest('https://i.ua'), CosmeticOption.CosmeticOptionAll);
        expect(res.elementHiding.specific).toHaveLength(1);
        expect(
            getRawRuleIndex(preprocessed.rawFilterList, specificHidingRuleWithoutWww),
        ).toBe(
            getRuleSourceIndex(res.elementHiding.specific[0].getIndex(), preprocessed.sourceMap),
        );

        res = engine.getCosmeticResult(createRequest('https://mail.i.ua'), CosmeticOption.CosmeticOptionAll);
        expect(res.elementHiding.specific).toHaveLength(1);
        expect(
            getRawRuleIndex(preprocessed.rawFilterList, specificHidingRuleWithoutWww),
        ).toBe(
            getRuleSourceIndex(res.elementHiding.specific[0].getIndex(), preprocessed.sourceMap),
        );

        // both rules match
        res = engine.getCosmeticResult(createRequest('https://www.i.ua'), CosmeticOption.CosmeticOptionAll);
        expect(res.elementHiding.specific).toHaveLength(2);
    });

    it('should find js rules for subdomains', () => {
        const scriptletRule = 'example.org#%#//scriptlet("abort-on-property-read", "alert")';
        const subDomainScriptletRule = 'sub.example.org#%#//scriptlet("abort-on-property-read", "alert")';
        const otherSubDomainScriptletRule = 'other-sub.example.org#%#//scriptlet("abort-on-property-read", "alert")';

        const rules = [
            scriptletRule,
            subDomainScriptletRule,
            otherSubDomainScriptletRule,
        ];

        const preprocessed = FilterListPreprocessor.preprocess(rules.join('\n'));

        const list = new BufferRuleList(1, preprocessed.filterList, false, false, false, preprocessed.sourceMap);
        const engine = new Engine(new RuleStorage([list]));

        const resOne = engine.getCosmeticResult(
            createRequest('https://example.org/test'),
            CosmeticOption.CosmeticOptionAll,
        );
        expect(resOne).toBeDefined();
        expect(resOne.JS.specific).toHaveLength(1);
        expect(
            getRawRuleIndex(preprocessed.rawFilterList, scriptletRule),
        ).toBe(
            getRuleSourceIndex(resOne.JS.specific[0].getIndex(), preprocessed.sourceMap),
        );

        const resTwo = engine.getCosmeticResult(
            createRequest('https://sub.example.org/test'),
            CosmeticOption.CosmeticOptionAll,
        );
        expect(resTwo).toBeDefined();
        expect(resTwo.JS.specific).toHaveLength(2);
        const indexes = resTwo.JS.specific.map((rule) => getRuleSourceIndex(rule.getIndex(), preprocessed.sourceMap));
        expect(indexes).toContain(getRawRuleIndex(preprocessed.rawFilterList, scriptletRule));
        expect(indexes).toContain(getRawRuleIndex(preprocessed.rawFilterList, subDomainScriptletRule));
        expect(indexes).not.toContain(getRawRuleIndex(preprocessed.rawFilterList, otherSubDomainScriptletRule));
    });

    it('should match rules with tld domain only', () => {
        const hidingRule = 'org##body';
        const rules = [hidingRule];
        const processed = FilterListPreprocessor.preprocess(rules.join('\n'));
        const list = new BufferRuleList(1, processed.filterList, false, false, false, processed.sourceMap);
        const engine = new Engine(new RuleStorage([list]));

        let res = engine.getCosmeticResult(createRequest('http://example.org'), CosmeticOption.CosmeticOptionAll);
        expect(res.elementHiding.specific).toHaveLength(1);
        expect(
            getRawRuleIndex(processed.rawFilterList, hidingRule),
        ).toBe(
            getRuleSourceIndex(res.elementHiding.specific[0].getIndex(), processed.sourceMap),
        );

        res = engine.getCosmeticResult(createRequest('https://www.example.org/'), CosmeticOption.CosmeticOptionAll);
        expect(res.elementHiding.specific).toHaveLength(1);
        expect(
            getRawRuleIndex(processed.rawFilterList, hidingRule),
        ).toBe(
            getRuleSourceIndex(res.elementHiding.specific[0].getIndex(), processed.sourceMap),
        );
    });
});

describe('$specifichide modifier', () => {
    it('should not allowlist generic rules', () => {
        const elemhideRule = 'example.org##div';
        const cosmeticRule = 'example.org#$#div { display: none !important; }';
        const genericCosmeticRule = '#$#div { display: none !important; }';
        const genericElemhideRule = '##div';
        const genericCssRuleWithExclusion = '~google.com#$#div { display: none !important }';
        const specifichideRule = '@@||example.org^$specifichide';
        const processed = FilterListPreprocessor.preprocess([
            elemhideRule,
            cosmeticRule,
            genericCosmeticRule,
            genericElemhideRule,
            genericCssRuleWithExclusion,
            specifichideRule,
        ].join('\n'));
        const list = new BufferRuleList(1, processed.filterList, false, false, false, processed.sourceMap);
        const engine = new Engine(new RuleStorage([list]));
        const request = new Request('http://example.org', '', RequestType.Document);
        const result = engine.matchRequest(request);
        const cosmeticResult = engine.getCosmeticResult(createRequest('http://example.org'), result.getCosmeticOption());
        expect(cosmeticResult).toBeTruthy();
        expect(cosmeticResult.elementHiding.specific).toHaveLength(0);
        expect(cosmeticResult.elementHiding.generic).toHaveLength(1);
        expect(cosmeticResult.elementHiding.generic[0]).toMatchCosmeticRule(createCosmeticRule(genericElemhideRule));
        expect(cosmeticResult.elementHiding.generic).toHaveLength(1);
        expect(
            getRawRuleIndex(processed.rawFilterList, genericElemhideRule),
        ).toBe(
            getRuleSourceIndex(cosmeticResult.elementHiding.generic[0].getIndex(), processed.sourceMap),
        );
        expect(cosmeticResult.CSS.specific).toHaveLength(0);
        expect(cosmeticResult.CSS.generic).toHaveLength(2);

        const cssGenericRules = cosmeticResult.CSS.generic;

        const genericCssRuleWithExclusionIndex = getRawRuleIndex(processed.rawFilterList, genericCssRuleWithExclusion);
        expect(
            cssGenericRules.some(
                (rule) => getRuleSourceIndex(rule.getIndex(), processed.sourceMap) === genericCssRuleWithExclusionIndex,
            ),
        ).toBeTruthy();

        const genericCosmeticRuleIndex = getRawRuleIndex(processed.rawFilterList, genericCosmeticRule);
        expect(
            cssGenericRules.some(
                (rule) => getRuleSourceIndex(rule.getIndex(), processed.sourceMap) === genericCosmeticRuleIndex,
            ),
        ).toBeTruthy();
    });
});

describe('Stealth cookie rules', () => {
    it('allowlists stealth cookie rules', () => {
        const stealthCookieRule = '$cookie=/.+/;maxAge=60';
        let list = new BufferRuleList(1, FilterListPreprocessor.preprocess([
            stealthCookieRule,
        ].join('\n')).filterList);
        let engine = new Engine(new RuleStorage([list]));
        let request = new Request('http://example.org', '', RequestType.Document);
        let result = engine.matchRequest(request);
        let cookieRules = result.getCookieRules();
        expect(cookieRules[0]).toMatchNetworkRule(createNetworkRule(stealthCookieRule));

        const allowlistRule = '@@||example.org^$stealth,removeparam,cookie';
        list = new BufferRuleList(1, FilterListPreprocessor.preprocess([
            stealthCookieRule,
            allowlistRule,
        ].join('\n')).filterList);
        engine = new Engine(new RuleStorage([list]));
        request = new Request('http://example.org', '', RequestType.Document);
        result = engine.matchRequest(request);
        cookieRules = result.getCookieRules();
        expect(cookieRules[0]).toMatchNetworkRule(createNetworkRule(allowlistRule));
    });
});
