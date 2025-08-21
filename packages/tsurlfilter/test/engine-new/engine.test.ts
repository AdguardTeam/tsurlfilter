// FIXME: fix getText cases
import escapeStringRegexp from 'escape-string-regexp';
import { describe, expect, it } from 'vitest';

import { config, setConfiguration } from '../../src/configuration';
import { CosmeticOption } from '../../src/engine-new/cosmetic-option';
import { EngineFactory } from '../../src/engine-new/engine-factory';
import { Request } from '../../src/request';
import { RequestType } from '../../src/request-type';

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
        const text = rules.join('\n');
        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text,
                },
            ],
        });

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
        const text = rules.join('\n');
        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text,
                },
            ],
        });

        expect(engine.getRulesCount()).toBe(1);

        const request = new Request('https://example.org', '', RequestType.Document);
        const result = engine.matchRequest(request);

        expect(result.basicRule).not.toBeNull();
        // eslint-disable-next-line max-len
        expect(engine.retrieveRuleText(result.basicRule!.getFilterListId(), result.basicRule!.getIndex())).toBe(ruleText);
        expect(result.documentRule).toBeNull();

        let frameRule = engine.matchFrame('https://example.org');
        expect(frameRule).not.toBeNull();
        expect(engine.retrieveRuleText(frameRule!.getFilterListId(), frameRule!.getIndex())).toBe(ruleText);

        frameRule = engine.matchFrame('https://test.com');
        expect(frameRule).toBeNull();
    });

    it('retrieveRuleText', () => {
        const rules1 = [
            '||example.org^$third-party',
            '##banner',
        ];
        const list1 = rules1.join('\n');

        const rules2 = [
            "#%#//scriptlet('set-constant', 'foo', 'bar')",
            '#@#.yay',
        ];
        const list2 = rules2.join('\n');

        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text: list1,
                },
                {
                    id: 2,
                    text: list2,
                },
            ],
        });

        expect(engine.getRulesCount()).toBe(4);

        // List 1
        let ruleText: string | null = engine.retrieveRuleText(1, getRawRuleIndex(list1, rules1[0]));
        expect(ruleText).not.toBeNull();
        expect(ruleText).toStrictEqual('||example.org^$third-party');

        ruleText = engine.retrieveRuleText(1, getRawRuleIndex(list1, rules1[1]));
        expect(ruleText).not.toBeNull();
        expect(ruleText).toStrictEqual('##banner');

        // List 2
        ruleText = engine.retrieveRuleText(2, getRawRuleIndex(list2, rules2[0]));
        expect(ruleText).not.toBeNull();
        expect(ruleText).toStrictEqual("#%#//scriptlet('set-constant', 'foo', 'bar')");

        ruleText = engine.retrieveRuleText(2, getRawRuleIndex(list2, rules2[1]));
        expect(ruleText).not.toBeNull();
        expect(ruleText).toStrictEqual('#@#.yay');

        // Should return null if the rule is not found, e.g. wrong filterId or ruleIndex
        ruleText = engine.retrieveRuleText(1, 9999);
        expect(ruleText).toBeNull();

        ruleText = engine.retrieveRuleText(2000, 4);
        expect(ruleText).toBeNull();
    });
});

describe('TestEngine - postponed load rules', () => {
    const rules = ['||example.org^$third-party', 'example.org##banner'];

    it('works rules are loaded', () => {
        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text: rules.join('\n'),
                },
            ],
            skipInitialScan: true,
        });

        expect(engine.getRulesCount()).toBe(0);

        engine.loadRules();

        expect(engine.getRulesCount()).toBe(2);
    });

    it('works rules are loaded async', async () => {
        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text: rules.join('\r\n'),
                },
            ],
            skipInitialScan: true,
        });

        expect(engine.getRulesCount()).toBe(0);

        await engine.loadRulesAsync(1);

        expect(engine.getRulesCount()).toBe(2);
    });
});

it('TestEngine - configuration', () => {
    const rules = ['||example.org^$third-party'];
    setConfiguration({
        engine: 'test-engine',
        version: 'test-version',
        verbose: true,
    });

    EngineFactory.createEngine({
        filters: [
            {
                id: 1,
                text: rules.join('\n'),
            },
        ],
    });

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

        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text: rules.join('\n'),
                },
            ],
        });

        const request = new Request('https://example.org', '', RequestType.Document);
        const result = engine.matchRequest(request);

        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeNull();
        expect(result.replaceRules).not.toBeNull();
        expect(result.replaceRules).toHaveLength(1);
        expect(
            engine.retrieveRuleText(result.replaceRules![0].getFilterListId(), result.replaceRules![0].getIndex()),
        ).toBe(replaceRule);
        expect(result.cspRules).not.toBeNull();
        expect(result.cspRules).toHaveLength(1);
        expect(
            engine.retrieveRuleText(result.cspRules![0].getFilterListId(), result.cspRules![0].getIndex()),
        ).toBe(cspRule);
        expect(result.cookieRules).not.toBeNull();
        expect(result.cookieRules).toHaveLength(1);
        expect(
            engine.retrieveRuleText(result.cookieRules![0].getFilterListId(), result.cookieRules![0].getIndex()),
        ).toBe(cookieRule);
        expect(result.removeParamRules).not.toBeNull();
        expect(result.removeParamRules).toHaveLength(1);
        expect(
            // eslint-disable-next-line max-len
            engine.retrieveRuleText(result.removeParamRules![0].getFilterListId(), result.removeParamRules![0].getIndex()),
        ).toBe(removeParamRule);
        expect(result.stealthRules).toBeNull();
    });

    it('it excludes allowlist rules, even if there are two badfilter rules', () => {
        const redirectRule = '/fuckadblock.$script,redirect=prevent-fab-3.2.0';
        const allowlistRule = '@@/fuckadblock.min.js$domain=example.org';
        const allowlistBadfilterRule = '@@/fuckadblock.min.js$domain=example.org,badfilter';
        const badfilterRule = '/fuckadblock.min.js$badfilter';

        const text = [
            redirectRule,
            allowlistRule,
            badfilterRule,
            allowlistBadfilterRule,
        ].join('\n');

        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text,
                },
            ],
        });

        const request = new Request(
            'https://example.org/fuckadblock.min.js',
            'https://example.org/url.html',
            RequestType.Script,
        );
        const result = engine.matchRequest(request);

        const rule = result.getBasicResult();
        expect(rule).not.toBeNull();
        expect(engine.retrieveRuleText(rule!.getFilterListId(), rule!.getIndex())).toBe(redirectRule);
        expect(result.getDocumentBlockingResult()).toBeNull();
    });
});

describe('TestEngineMatchRequest - redirect modifier', () => {
    it('checks if with redirect modifier resource type is not ignored', () => {
        const text = [
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=1x1-transparent.gif',
            '@@||ya.ru$redirect=1x1-transparent.gif',
        ].join('\n');

        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text,
                },
            ],
        });

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
        const text = [
            '||ya.ru$redirect=1x1-transparent.gif',
            '@@||ya.ru$redirect=1x1-transparent.gif,image',
        ].join('\n');

        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text,
                },
            ],
        });

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
        const text = [
            '||ya.ru$redirect=1x1-transparent.gif',
            '@@||ya.ru$redirect=2x2-transparent.png',
        ].join('\n');

        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text,
                },
            ],
        });

        const request = new Request(
            'http://ya.ru/',
            null,
            RequestType.Image,
        );
        const basicResult = engine.matchRequest(request).getBasicResult();
        expect(basicResult).not.toBeNull();
        expect(
            engine.retrieveRuleText(basicResult!.getFilterListId(), basicResult!.getIndex()),
        ).toBe('||ya.ru$redirect=1x1-transparent.gif');
    });

    it('checks that it is possible to exclude all redirects with `@@$redirect` rule', () => {
        const text = [
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=1x1-transparent.gif',
            '||ya.ru$redirect=2x2-transparent.png',
            '@@||ya.ru$redirect',
        ].join('\n');

        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text,
                },
            ],
        });

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
        const text = [
            '||ya.ru$redirect=1x1-transparent.gif,image',
            '||ya.ru$redirect=1x1-transparent.gif',
            '||ya.ru$redirect=2x2-transparent.png',
            '@@||ya.ru$redirect,image',
        ].join('\n');

        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text,
                },
            ],
        });

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
        const text = [
            '||example.org/script.js',
            '||example.org^$redirect-rule=noopjs',
        ].join('\n');

        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text,
                },
            ],
        });

        let request = new Request(
            'https://example.org/script.js',
            null,
            RequestType.Script,
        );
        let result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(result.getBasicResult()!.getFilterListId(), result.getBasicResult()!.getIndex()),
        ).toBe('||example.org^$redirect-rule=noopjs');

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

        const text = rules.join('\n');

        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text,
                },
            ],
        });

        let request = new Request(
            'https://example.org/script.js',
            null,
            RequestType.Script,
        );
        let result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(
            getRawRuleIndex(text, rules[1]),
        ).toBe(
            result.getBasicResult()!.getIndex(),
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
            getRawRuleIndex(text, rules[0]),
        ).toBe(
            result.getBasicResult()!.getIndex(),
        );
    });
});

describe('TestEngineMatchRequest - document modifier', () => {
    it('respects document modifier request type in blocking rules', () => {
        const documentBlockingRuleText = '||example.org^$document';

        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text: documentBlockingRuleText,
                },
            ],
        });

        let request = new Request('http://example.org/', null, RequestType.Document);
        let result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(result.getBasicResult()!.getFilterListId(), result.getBasicResult()!.getIndex()),
        ).toBe(documentBlockingRuleText);
        expect(result.getDocumentBlockingResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(
                result.getDocumentBlockingResult()!.getFilterListId(),
                result.getDocumentBlockingResult()!.getIndex(),
            ),
        ).toBe(documentBlockingRuleText);

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

        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text: documentBlockingRuleText,
                },
            ],
        });

        let request = new Request('http://example.org/', null, RequestType.Document);
        let result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(result.getBasicResult()!.getFilterListId(), result.getBasicResult()!.getIndex()),
        ).toBe(documentBlockingRuleText);
        expect(result.getDocumentBlockingResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(
                result.getDocumentBlockingResult()!.getFilterListId(),
                result.getDocumentBlockingResult()!.getIndex(),
            ),
        ).toBe(documentBlockingRuleText);

        request = new Request('http://example.org/', null, RequestType.Script);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(result.getBasicResult()!.getFilterListId(), result.getBasicResult()!.getIndex()),
        ).toBe(documentBlockingRuleText);
        expect(result.getDocumentBlockingResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(
                result.getDocumentBlockingResult()!.getFilterListId(),
                result.getDocumentBlockingResult()!.getIndex(),
            ),
        ).toBe(documentBlockingRuleText);

        request = new Request('http://example.org/', null, RequestType.Image);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).toBeNull();
        expect(result.getDocumentBlockingResult()).toBeNull();
    });
});

describe('TestEngineMatchRequest - all modifier', () => {
    it('respects $all modifier with all request types in blocking rules', () => {
        const allBlockingRuleText = '||example.org^$all';
        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text: allBlockingRuleText,
                },
            ],
        });

        let request = new Request('http://example.org/', null, RequestType.Document);
        let result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(result.getBasicResult()!.getFilterListId(), result.getBasicResult()!.getIndex()),
        ).toBe(allBlockingRuleText);
        expect(result.getDocumentBlockingResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(
                result.getDocumentBlockingResult()!.getFilterListId(),
                result.getDocumentBlockingResult()!.getIndex(),
            ),
        ).toBe(allBlockingRuleText);

        request = new Request('http://other.org/', null, RequestType.Document);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).toBeNull();
        expect(result.getDocumentBlockingResult()).toBeNull();

        request = new Request('http://example.org/', null, RequestType.Image);
        result = engine.matchRequest(request);
        expect(
            engine.retrieveRuleText(result.getBasicResult()!.getFilterListId(), result.getBasicResult()!.getIndex()),
        ).toBe(allBlockingRuleText);
        expect(result.getDocumentBlockingResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(
                result.getDocumentBlockingResult()!.getFilterListId(),
                result.getDocumentBlockingResult()!.getIndex(),
            ),
        ).toBe(allBlockingRuleText);
    });
});

describe('TestEngineMatchRequest - popup modifier', () => {
    it('match requests against basic and popup blocking rules', () => {
        const blockingRuleText = '||example.org^';
        const popupBlockingRuleText = '||example.org^$popup';
        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text: blockingRuleText,
                },
                {
                    id: 2,
                    text: popupBlockingRuleText,
                },
            ],
        });

        // Tests matching an XMLHttpRequest; expects to match the basic blocking rule
        let request = new Request('http://example.org/', 'http://example.com/', RequestType.XmlHttpRequest);
        let result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(result.getBasicResult()!.getFilterListId(), result.getBasicResult()!.getIndex()),
        ).toBe(blockingRuleText);
        expect(
            engine.retrieveRuleText(result.getPopupRule()!.getFilterListId(), result.getPopupRule()!.getIndex()),
        ).toEqual(popupBlockingRuleText);
        expect(result.getDocumentBlockingResult()).toBeNull();

        // Tests matching a script request; expects to match the basic blocking rule
        request = new Request('http://example.org/', 'http://example.com/', RequestType.Script);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(result.getBasicResult()!.getFilterListId(), result.getBasicResult()!.getIndex()),
        ).toBe(blockingRuleText);
        expect(
            engine.retrieveRuleText(result.getPopupRule()!.getFilterListId(), result.getPopupRule()!.getIndex()),
        ).toEqual(popupBlockingRuleText);
        expect(result.getDocumentBlockingResult()).toBeNull();

        // Tests matching an image request; expects to match the basic blocking rule
        request = new Request('http://example.org/', 'http://example.com/', RequestType.Image);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(result.getBasicResult()!.getFilterListId(), result.getBasicResult()!.getIndex()),
        ).toBe(blockingRuleText);
        expect(
            engine.retrieveRuleText(result.getPopupRule()!.getFilterListId(), result.getPopupRule()!.getIndex()),
        ).toEqual(popupBlockingRuleText);
        expect(result.getDocumentBlockingResult()).toBeNull();

        // Tests matching a document request; expects to match the popup blocking rule
        request = new Request('http://example.org/', 'http://example.com/', RequestType.Document);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(result.getBasicResult()!.getFilterListId(), result.getBasicResult()!.getIndex()),
        ).toBe(blockingRuleText);
        expect(
            engine.retrieveRuleText(result.getPopupRule()!.getFilterListId(), result.getPopupRule()!.getIndex()),
        ).toBe(popupBlockingRuleText);
    });

    it('match requests against all and popup blocking rules', () => {
        const blockingAllRuleText = '||example.org^$all';
        const popupBlockingRuleText = '||example.org^$popup';
        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text: blockingAllRuleText,
                },
                {
                    id: 2,
                    text: popupBlockingRuleText,
                },
            ],
        });

        // Tests matching an XMLHttpRequest; expects to match the all-encompassing blocking rule
        let request = new Request('http://example.org/', 'http://example.com/', RequestType.XmlHttpRequest);
        let result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(result.getBasicResult()!.getFilterListId(), result.getBasicResult()!.getIndex()),
        ).toBe(blockingAllRuleText);
        expect(
            engine.retrieveRuleText(result.getPopupRule()!.getFilterListId(), result.getPopupRule()!.getIndex()),
        ).toEqual(popupBlockingRuleText);
        expect(result.getDocumentBlockingResult()).not.toBeNull();

        // Tests matching a script request; expects to match the all-encompassing blocking rule
        request = new Request('http://example.org/', 'http://example.com/', RequestType.Script);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(result.getBasicResult()!.getFilterListId(), result.getBasicResult()!.getIndex()),
        ).toBe(blockingAllRuleText);
        expect(
            engine.retrieveRuleText(result.getPopupRule()!.getFilterListId(), result.getPopupRule()!.getIndex()),
        ).toEqual(popupBlockingRuleText);
        expect(result.getDocumentBlockingResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(
                result.getDocumentBlockingResult()!.getFilterListId(),
                result.getDocumentBlockingResult()!.getIndex(),
            ),
        ).toBe(blockingAllRuleText);

        // Tests matching an image request; expects to match the all-encompassing blocking rule
        request = new Request('http://example.org/', 'http://example.com/', RequestType.Image);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(result.getBasicResult()!.getFilterListId(), result.getBasicResult()!.getIndex()),
        ).toBe(blockingAllRuleText);
        expect(
            engine.retrieveRuleText(result.getPopupRule()!.getFilterListId(), result.getPopupRule()!.getIndex()),
        ).toEqual(popupBlockingRuleText);
        expect(result.getDocumentBlockingResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(
                result.getDocumentBlockingResult()!.getFilterListId(),
                result.getDocumentBlockingResult()!.getIndex(),
            ),
        ).toBe(blockingAllRuleText);

        // Tests matching a document request; expects to match the popup blocking rule
        request = new Request('http://example.org/', 'http://example.com/', RequestType.Document);
        result = engine.matchRequest(request);
        expect(result.getBasicResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(result.getBasicResult()!.getFilterListId(), result.getBasicResult()!.getIndex()),
        ).toBe(blockingAllRuleText);
        expect(
            engine.retrieveRuleText(result.getPopupRule()!.getFilterListId(), result.getPopupRule()!.getIndex()),
        ).toBe(popupBlockingRuleText);
        expect(result.getDocumentBlockingResult()).not.toBeNull();
        expect(
            engine.retrieveRuleText(
                result.getDocumentBlockingResult()!.getFilterListId(),
                result.getDocumentBlockingResult()!.getIndex(),
            ),
        ).toBe(blockingAllRuleText);
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

    const engine = EngineFactory.createEngine({
        filters: [
            {
                id: 1,
                text: rules.join('\n'),
            },
        ],
    });

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

    const engine = EngineFactory.createEngine({
        filters: [
            {
                id: 1,
                text: rules.join('\n'),
            },
        ],
    });

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
        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text: rawFilterList,
                },
            ],
        });
        const result = engine.getCosmeticResult(
            createRequest('https://flightradar24.com.ru/faq/'),
            CosmeticOption.CosmeticOptionAll,
        );

        expect(result.JS.specific.length).toEqual(1);
        expect(
            getRawRuleIndex(rawFilterList, jsRule),
        ).toBe(
            result.JS.specific[0].getIndex(),
        );

        expect(result.elementHiding.specific.length).toEqual(1);
        expect(
            getRawRuleIndex(rawFilterList, hidingRule),
        ).toBe(
            result.elementHiding.specific[0].getIndex(),
        );
    });

    it('works if returns correct cosmetic js result', () => {
        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text: rules.join('\n'),
                },
            ],
        });

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
        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text: rules.join('\n'),
                    ignoreJS: true,
                },
            ],
        });

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

        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text: [important, urlblock].join('\n'),
                },
            ],
        });

        const frameRule = engine.matchFrame('http://example.org');
        expect(frameRule).not.toBeNull();
        expect(
            engine.retrieveRuleText(frameRule!.getFilterListId(), frameRule!.getIndex()),
        ).toBe(urlblock);

        const request = new Request('http://example.com/image.png', 'http://example.org', RequestType.Image);
        const result = engine.matchRequest(request, frameRule);
        const basicResult = result.getBasicResult();
        expect(basicResult).toBeTruthy();
        expect(
            engine.retrieveRuleText(basicResult!.getFilterListId(), basicResult!.getIndex()),
        ).toEqual(important);
        expect(result.getDocumentBlockingResult()).toBeNull();
    });
});

describe('$badfilter modifier', () => {
    it('checks badfilter rule negates network rule', () => {
        const rules = [
            '$script,domain=example.com|example.org',
            '$script,domain=example.com,badfilter',
        ];
        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text: rules.join('\n'),
                },
            ],
        });

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

        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text: [
                        networkGenericRule,
                        networkNegatedGenericRule,
                        genericblockRule,
                    ].join('\n'),
                },
            ],
        });

        const frameRule = engine.matchFrame('https://domain.com');
        expect(frameRule).not.toBeNull();
        expect(
            engine.retrieveRuleText(frameRule!.getFilterListId(), frameRule!.getIndex()),
        ).toBe(genericblockRule);

        const result = engine.matchRequest(new Request(
            'https://example.org',
            'https://domain.com',
            RequestType.Script,
        ), frameRule);

        expect(result.basicRule).toBeNull();
        expect(
            engine.retrieveRuleText(result.documentRule!.getFilterListId(), result.documentRule!.getIndex()),
        ).toBe(genericblockRule);
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
        const text = rules.join('\n');
        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text,
                },
            ],
        });

        let res = engine.getCosmeticResult(createRequest('https://www.example.org/'), CosmeticOption.CosmeticOptionAll);
        expect(res).toBeDefined();

        expect(res.elementHiding.specific).toHaveLength(1);
        expect(
            getRawRuleIndex(text, specificHidingRule),
        ).toBe(
            res.elementHiding.specific[0].getIndex(),
        );

        res = engine.getCosmeticResult(createRequest('https://sub.example.org'), CosmeticOption.CosmeticOptionAll);
        expect(res).toBeDefined();
        expect(res.elementHiding.specific).toHaveLength(2);

        expect(
            res.elementHiding.specific.map((rule) => rule.getIndex()),
        ).toContain(
            getRawRuleIndex(text, specificHidingRule),
        );

        expect(
            res.elementHiding.specific.map((rule) => rule.getIndex()),
        ).toContain(
            getRawRuleIndex(text, specificHidingRuleSubdomain),
        );
    });

    it('should find css rules with www only for domains with www', () => {
        const specificHidingRuleWithWww = 'www.i.ua###Premium';
        const specificHidingRuleWithoutWww = 'i.ua###Premium';
        const rules = [
            specificHidingRuleWithWww,
            specificHidingRuleWithoutWww,
        ];
        const text = rules.join('\n');
        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text,
                },
            ],
        });

        let res = engine.getCosmeticResult(createRequest('https://i.ua'), CosmeticOption.CosmeticOptionAll);
        expect(res.elementHiding.specific).toHaveLength(1);
        expect(
            getRawRuleIndex(text, specificHidingRuleWithoutWww),
        ).toBe(
            res.elementHiding.specific[0].getIndex(),
        );

        res = engine.getCosmeticResult(createRequest('https://mail.i.ua'), CosmeticOption.CosmeticOptionAll);
        expect(res.elementHiding.specific).toHaveLength(1);
        expect(
            getRawRuleIndex(text, specificHidingRuleWithoutWww),
        ).toBe(
            res.elementHiding.specific[0].getIndex(),
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
        const text = rules.join('\n');
        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text,
                },
            ],
        });

        const resOne = engine.getCosmeticResult(
            createRequest('https://example.org/test'),
            CosmeticOption.CosmeticOptionAll,
        );
        expect(resOne).toBeDefined();
        expect(resOne.JS.specific).toHaveLength(1);
        expect(
            getRawRuleIndex(text, scriptletRule),
        ).toBe(
            resOne.JS.specific[0].getIndex(),
        );

        const resTwo = engine.getCosmeticResult(
            createRequest('https://sub.example.org/test'),
            CosmeticOption.CosmeticOptionAll,
        );
        expect(resTwo).toBeDefined();
        expect(resTwo.JS.specific).toHaveLength(2);
        const indexes = resTwo.JS.specific.map((rule) => rule.getIndex());
        expect(indexes).toContain(getRawRuleIndex(text, scriptletRule));
        expect(indexes).toContain(getRawRuleIndex(text, subDomainScriptletRule));
        expect(indexes).not.toContain(getRawRuleIndex(text, otherSubDomainScriptletRule));
    });

    it('should match rules with tld domain only', () => {
        const hidingRule = 'org##body';
        const rules = [hidingRule];
        const text = rules.join('\n');
        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text,
                },
            ],
        });

        let res = engine.getCosmeticResult(createRequest('http://example.org'), CosmeticOption.CosmeticOptionAll);
        expect(res.elementHiding.specific).toHaveLength(1);
        expect(
            getRawRuleIndex(text, hidingRule),
        ).toBe(
            res.elementHiding.specific[0].getIndex(),
        );

        res = engine.getCosmeticResult(createRequest('https://www.example.org/'), CosmeticOption.CosmeticOptionAll);
        expect(res.elementHiding.specific).toHaveLength(1);
        expect(
            getRawRuleIndex(text, hidingRule),
        ).toBe(
            res.elementHiding.specific[0].getIndex(),
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
        const text = [
            elemhideRule,
            cosmeticRule,
            genericCosmeticRule,
            genericElemhideRule,
            genericCssRuleWithExclusion,
            specifichideRule,
        ].join('\n');
        const engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text,
                },
            ],
        });
        const request = new Request('http://example.org', '', RequestType.Document);
        const result = engine.matchRequest(request);
        const cosmeticResult = engine.getCosmeticResult(createRequest('http://example.org'), result.getCosmeticOption());
        expect(cosmeticResult).toBeTruthy();
        expect(cosmeticResult.elementHiding.specific).toHaveLength(0);
        expect(cosmeticResult.elementHiding.generic).toHaveLength(1);
        // expect(cosmeticResult.elementHiding.generic[0].getText()).toBe(genericElemhideRule);
        expect(cosmeticResult.elementHiding.generic).toHaveLength(1);
        expect(
            getRawRuleIndex(text, genericElemhideRule),
        ).toBe(
            cosmeticResult.elementHiding.generic[0].getIndex(),
        );
        expect(cosmeticResult.CSS.specific).toHaveLength(0);
        expect(cosmeticResult.CSS.generic).toHaveLength(2);

        const cssGenericRules = cosmeticResult.CSS.generic;

        const genericCssRuleWithExclusionIndex = getRawRuleIndex(text, genericCssRuleWithExclusion);
        expect(
            cssGenericRules.some(
                (rule) => rule.getIndex() === genericCssRuleWithExclusionIndex,
            ),
        ).toBeTruthy();

        const genericCosmeticRuleIndex = getRawRuleIndex(text, genericCosmeticRule);
        expect(
            cssGenericRules.some(
                (rule) => rule.getIndex() === genericCosmeticRuleIndex,
            ),
        ).toBeTruthy();
    });
});

describe('Stealth cookie rules', () => {
    it('allowlists stealth cookie rules', () => {
        const stealthCookieRule = '$cookie=/.+/;maxAge=60';
        let rules = [stealthCookieRule];
        let text = rules.join('\n');
        let engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text,
                },
            ],
        });
        let request = new Request('http://example.org', '', RequestType.Document);
        let result = engine.matchRequest(request);
        let cookieRules = result.getCookieRules();
        expect(
            engine.retrieveRuleText(cookieRules[0].getFilterListId(), cookieRules[0].getIndex()),
        ).toBe(stealthCookieRule);

        const allowlistRule = '@@||example.org^$stealth,removeparam,cookie';
        rules = [stealthCookieRule, allowlistRule];
        text = rules.join('\n');
        engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text,
                },
            ],
        });
        request = new Request('http://example.org', '', RequestType.Document);
        result = engine.matchRequest(request);
        cookieRules = result.getCookieRules();
        expect(
            engine.retrieveRuleText(cookieRules[0].getFilterListId(), cookieRules[0].getIndex()),
        ).toBe(allowlistRule);
    });
});

describe('Unsafe rules can be ignored', () => {
    it('allowlists stealth cookie rules', () => {
        const rule = '||example.org^$removeparam=foo';
        const rules = [rule];
        const text = rules.join('\n');
        let engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text,
                    ignoreUnsafe: true,
                },
            ],
        });
        let request = new Request('http://example.org', '', RequestType.Document);
        let result = engine.matchRequest(request);
        let removeParamRules = result.getRemoveParamRules();
        expect(removeParamRules).toHaveLength(0);

        engine = EngineFactory.createEngine({
            filters: [
                {
                    id: 1,
                    text,
                    ignoreUnsafe: false,
                },
            ],
        });
        request = new Request('http://example.org', '', RequestType.Document);
        result = engine.matchRequest(request);
        removeParamRules = result.getRemoveParamRules();
        expect(removeParamRules).toHaveLength(1);
        expect(
            engine.retrieveRuleText(removeParamRules[0].getFilterListId(), removeParamRules[0].getIndex()),
        ).toEqual(rule);
    });
});
