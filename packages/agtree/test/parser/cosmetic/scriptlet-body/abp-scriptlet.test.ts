import {
    describe,
    test,
    expect,
    vi,
} from 'vitest';

import { NodeExpectContext, type NodeExpectFn } from '../../../helpers/node-utils';
import { type ScriptletInjectionRuleBody } from '../../../../src/nodes';
import { AbpSnippetInjectionBodyParser } from '../../../../src/parser/cosmetic/body/abp-snippet-injection-body-parser';
import { AdblockSyntaxError } from '../../../../src/errors/adblock-syntax-error';
import { EMPTY, SPACE } from '../../../../src/utils/constants';
import {
    AbpSnippetInjectionBodyGenerator,
} from '../../../../src/generator/cosmetic/body/abp-snippet-injection-body-generator';
import {
    AbpSnippetInjectionBodySerializer,
} from '../../../../src/serializer/cosmetic/body/abp-snippet-injection-body-serializer';
import {
    AbpSnippetInjectionBodyDeserializer,
} from '../../../../src/deserializer/cosmetic/scriptlet-body/abp-snippet-injection-body-deserializer';
import { AbpSnippetInjectionBodyCommon } from '../../../../src/common/abp-snippet-injection-body-common';

describe('AbpSnippetInjectionBodyParser', () => {
    describe('AbpSnippetInjectionBodyParser.parse - valid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<ScriptletInjectionRuleBody> }>([
            {
                actual: String.raw`scriptlet0`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getFullRange(),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`scriptlet0`),
                                        value: String.raw`scriptlet0`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`scriptlet0 arg0`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getFullRange(),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`scriptlet0`),
                                        value: String.raw`scriptlet0`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`arg0`),
                                        value: String.raw`arg0`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`scriptlet0 arg0 arg1`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getFullRange(),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`scriptlet0`),
                                        value: String.raw`scriptlet0`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`arg0`),
                                        value: String.raw`arg0`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`arg1`),
                                        value: String.raw`arg1`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`scriptlet0 arg0_0\ arg0_1 arg1`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getFullRange(),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`scriptlet0`),
                                        value: String.raw`scriptlet0`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`arg0_0\ arg0_1`),
                                        value: String.raw`arg0_0\ arg0_1`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`arg1`),
                                        value: String.raw`arg1`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`scriptlet0 arg0 arg1;`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`scriptlet0 arg0 arg1`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`scriptlet0`),
                                        value: String.raw`scriptlet0`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`arg0`),
                                        value: String.raw`arg0`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`arg1`),
                                        value: String.raw`arg1`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`scriptlet0 'arg0 arg1;`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`scriptlet0 'arg0 arg1;`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`scriptlet0`),
                                        value: String.raw`scriptlet0`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'arg0 arg1;`),
                                        value: String.raw`'arg0 arg1;`,
                                    },

                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`scriptlet0 "arg0 arg1;`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`scriptlet0 "arg0 arg1;`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`scriptlet0`),
                                        value: String.raw`scriptlet0`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`"arg0 arg1;`),
                                        value: String.raw`"arg0 arg1;`,
                                    },

                                ],
                            },
                        ],
                    };
                },
            },
            {
                actual: String.raw`scriptlet0 some'thing`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getFullRange(),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`scriptlet0`),
                                        value: String.raw`scriptlet0`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`some'thing`),
                                        value: String.raw`some'thing`,
                                    },

                                ],
                            },
                        ],
                    };
                },
            },

            // multiple scriptlets
            {
                actual: String.raw`scriptlet0 arg00 arg01; scriptlet1; scriptlet2 arg20`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`scriptlet0 arg00 arg01`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`scriptlet0`),
                                        value: String.raw`scriptlet0`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`arg00`),
                                        value: String.raw`arg00`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`arg01`),
                                        value: String.raw`arg01`,
                                    },
                                ],
                            },
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`scriptlet1`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`scriptlet1`),
                                        value: String.raw`scriptlet1`,
                                    },
                                ],
                            },
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`scriptlet2 arg20`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`scriptlet2`),
                                        value: String.raw`scriptlet2`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`arg20`),
                                        value: String.raw`arg20`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },

            // Complicated cases
            {
                // eslint-disable-next-line max-len
                actual: String.raw`scriptlet0 arg00 /a;b/ 'a;b' "a;b"; scriptlet-1; scriptlet2 'arg20' arg21\ something;`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`scriptlet0 arg00 /a;b/ 'a;b' "a;b"`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`scriptlet0`),
                                        value: String.raw`scriptlet0`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`arg00`),
                                        value: String.raw`arg00`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`/a;b/`),
                                        value: String.raw`/a;b/`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'a;b'`),
                                        value: String.raw`'a;b'`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`"a;b"`),
                                        value: String.raw`"a;b"`,
                                    },
                                ],
                            },
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`scriptlet-1`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`scriptlet-1`),
                                        value: String.raw`scriptlet-1`,
                                    },
                                ],
                            },
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`scriptlet2 'arg20' arg21\ something`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`scriptlet2`),
                                        value: String.raw`scriptlet2`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'arg20'`),
                                        value: String.raw`'arg20'`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`arg21\ something`),
                                        value: String.raw`arg21\ something`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            /* eslint-disable max-len */
            {
                actual: String.raw`hide-if-matches-xpath './/*[@class="test-xpath-class"]'; hide-if-matches-xpath './/div[@id="aaa"]//div[starts-with(@id,"aaa")][.//h1//span/text()="aaa"]'; hide-if-matches-xpath './/div[@id="bbb"]//div[starts-with(@id,"bbb")][.//h1//span/text()="bbb"]'`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`hide-if-matches-xpath './/*[@class="test-xpath-class"]'`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`hide-if-matches-xpath`),
                                        value: String.raw`hide-if-matches-xpath`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'.//*[@class="test-xpath-class"]'`),
                                        value: String.raw`'.//*[@class="test-xpath-class"]'`,
                                    },
                                ],
                            },
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`hide-if-matches-xpath './/div[@id="aaa"]//div[starts-with(@id,"aaa")][.//h1//span/text()="aaa"]'`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`hide-if-matches-xpath`, 2),
                                        value: String.raw`hide-if-matches-xpath`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'.//div[@id="aaa"]//div[starts-with(@id,"aaa")][.//h1//span/text()="aaa"]'`),
                                        value: String.raw`'.//div[@id="aaa"]//div[starts-with(@id,"aaa")][.//h1//span/text()="aaa"]'`,
                                    },
                                ],
                            },
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`hide-if-matches-xpath './/div[@id="bbb"]//div[starts-with(@id,"bbb")][.//h1//span/text()="bbb"]'`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`hide-if-matches-xpath`, 3),
                                        value: String.raw`hide-if-matches-xpath`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'.//div[@id="bbb"]//div[starts-with(@id,"bbb")][.//h1//span/text()="bbb"]'`),
                                        value: String.raw`'.//div[@id="bbb"]//div[starts-with(@id,"bbb")][.//h1//span/text()="bbb"]'`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            // Complicated "real world" example
            // Source: https://github.com/abp-filters/abp-filters-anti-cv/blob/4474f3aafcdb87bb7dd4053f1950068f7e3906ef/fb_non-graph.txt#L2
            {
                actual: String.raw`race start; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ 'div[role=feed] div[role=article]' a[href="#"][role="link"]; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ 'div[role=feed] div[role=article]' a[href^="?__cft__"]; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ 'div[role=feed] div[role=article]' a[href="#"][role="link"]>span>span>b; hide-if-matches-xpath './/div[@role="feed"]//div[@role="article"]//a[@aria-label[.="Patrocinado" or .="Sponsa" or .="Bersponsor" or .="Commandité" or .="Ditaja" or .="Gesponsert" or .="Gesponsord" or .="Sponsrad" or .="Publicidad" or .="Sponsoreret" or .="Sponset" or .="Sponsored" or .="Sponsorisé" or .="Sponsorizat" or .="Sponsorizzato" or .="Sponsorlu" or .="Sponsorowane" or .="Реклама" or .="ממומן" or .="تمويل شوي" or .="دارای پشتیبانی مالی" or .="سپانسرڈ" or .="مُموَّل" or .="प्रायोजित" or .="সৌজন্যে" or .="ได้รับการสนับสนุน" or .="内容" or .="贊助" or .="Sponsoroitu" or .="May Sponsor" or .="Được tài trợ"]]/ancestor::div[@role="article"]'; race stop;`,
                expected: (context: NodeExpectContext): ScriptletInjectionRuleBody => {
                    return {
                        type: 'ScriptletInjectionRuleBody',
                        ...context.getFullRange(),
                        children: [
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`race start`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`race`),
                                        value: String.raw`race`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`start`),
                                        value: String.raw`start`,
                                    },
                                ],
                            },
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ 'div[role=feed] div[role=article]' a[href="#"][role="link"]`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`hide-if-contains-visible-text`, 1),
                                        value: String.raw`hide-if-contains-visible-text`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`/[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/`, 1),
                                        value: String.raw`/[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'div[role=feed] div[role=article]'`, 1),
                                        value: String.raw`'div[role=feed] div[role=article]'`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`a[href="#"][role="link"]`),
                                        value: String.raw`a[href="#"][role="link"]`,
                                    },
                                ],
                            },
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ 'div[role=feed] div[role=article]' a[href^="?__cft__"]`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`hide-if-contains-visible-text`, 2),
                                        value: String.raw`hide-if-contains-visible-text`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`/[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/`, 2),
                                        value: String.raw`/[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'div[role=feed] div[role=article]'`, 2),
                                        value: String.raw`'div[role=feed] div[role=article]'`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`a[href^="?__cft__"]`),
                                        value: String.raw`a[href^="?__cft__"]`,
                                    },
                                ],
                            },
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ 'div[role=feed] div[role=article]' a[href="#"][role="link"]>span>span>b`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`hide-if-contains-visible-text`, 3),
                                        value: String.raw`hide-if-contains-visible-text`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`/[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/`, 3),
                                        value: String.raw`/[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'div[role=feed] div[role=article]'`, 3),
                                        value: String.raw`'div[role=feed] div[role=article]'`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`a[href="#"][role="link"]>span>span>b`),
                                        value: String.raw`a[href="#"][role="link"]>span>span>b`,
                                    },
                                ],
                            },
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`hide-if-matches-xpath './/div[@role="feed"]//div[@role="article"]//a[@aria-label[.="Patrocinado" or .="Sponsa" or .="Bersponsor" or .="Commandité" or .="Ditaja" or .="Gesponsert" or .="Gesponsord" or .="Sponsrad" or .="Publicidad" or .="Sponsoreret" or .="Sponset" or .="Sponsored" or .="Sponsorisé" or .="Sponsorizat" or .="Sponsorizzato" or .="Sponsorlu" or .="Sponsorowane" or .="Реклама" or .="ממומן" or .="تمويل شوي" or .="دارای پشتیبانی مالی" or .="سپانسرڈ" or .="مُموَّل" or .="प्रायोजित" or .="সৌজন্যে" or .="ได้รับการสนับสนุน" or .="内容" or .="贊助" or .="Sponsoroitu" or .="May Sponsor" or .="Được tài trợ"]]/ancestor::div[@role="article"]'`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`hide-if-matches-xpath`),
                                        value: String.raw`hide-if-matches-xpath`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`'.//div[@role="feed"]//div[@role="article"]//a[@aria-label[.="Patrocinado" or .="Sponsa" or .="Bersponsor" or .="Commandité" or .="Ditaja" or .="Gesponsert" or .="Gesponsord" or .="Sponsrad" or .="Publicidad" or .="Sponsoreret" or .="Sponset" or .="Sponsored" or .="Sponsorisé" or .="Sponsorizat" or .="Sponsorizzato" or .="Sponsorlu" or .="Sponsorowane" or .="Реклама" or .="ממומן" or .="تمويل شوي" or .="دارای پشتیبانی مالی" or .="سپانسرڈ" or .="مُموَّل" or .="प्रायोजित" or .="সৌজন্যে" or .="ได้รับการสนับสนุน" or .="内容" or .="贊助" or .="Sponsoroitu" or .="May Sponsor" or .="Được tài trợ"]]/ancestor::div[@role="article"]'`),
                                        value: String.raw`'.//div[@role="feed"]//div[@role="article"]//a[@aria-label[.="Patrocinado" or .="Sponsa" or .="Bersponsor" or .="Commandité" or .="Ditaja" or .="Gesponsert" or .="Gesponsord" or .="Sponsrad" or .="Publicidad" or .="Sponsoreret" or .="Sponset" or .="Sponsored" or .="Sponsorisé" or .="Sponsorizat" or .="Sponsorizzato" or .="Sponsorlu" or .="Sponsorowane" or .="Реклама" or .="ממומן" or .="تمويل شوي" or .="دارای پشتیبانی مالی" or .="سپانسرڈ" or .="مُموَّل" or .="प्रायोजित" or .="সৌজন্যে" or .="ได้รับการสนับสนุน" or .="内容" or .="贊助" or .="Sponsoroitu" or .="May Sponsor" or .="Được tài trợ"]]/ancestor::div[@role="article"]'`,
                                    },
                                ],
                            },
                            {
                                type: 'ParameterList',
                                ...context.getRangeFor(String.raw`race stop`),
                                children: [
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`race`, 2),
                                        value: String.raw`race`,
                                    },
                                    {
                                        type: 'Value',
                                        ...context.getRangeFor(String.raw`stop`),
                                        value: String.raw`stop`,
                                    },
                                ],
                            },
                        ],
                    };
                },
            },
            /* eslint-enable max-len */
        ])("should parse '$actual'", ({ actual, expected: expectedFn }) => {
            // eslint-disable-next-line max-len
            expect(AbpSnippetInjectionBodyParser.parse(actual)).toMatchObject(expectedFn(new NodeExpectContext(actual)));
        });
    });

    describe('AbpSnippetInjectionBodyParser.parse - invalid cases', () => {
        test.each<{ actual: string; expected: NodeExpectFn<AdblockSyntaxError> }>([
            {
                actual: EMPTY,
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        AbpSnippetInjectionBodyCommon.ERROR_MESSAGES.EMPTY_SCRIPTLET_CALL,
                        ...context.toTuple(context.getFullRange()),
                    );
                },
            },

            {
                actual: SPACE,
                expected: (context: NodeExpectContext): AdblockSyntaxError => {
                    return new AdblockSyntaxError(
                        AbpSnippetInjectionBodyCommon.ERROR_MESSAGES.EMPTY_SCRIPTLET_CALL,
                        ...context.toTuple(context.getFullRange()),
                    );
                },
            },
        ])("should throw on input: '$actual'", ({ actual, expected: expectedFn }) => {
            const fn = vi.fn(() => AbpSnippetInjectionBodyParser.parse(actual));

            // parse should throw
            expect(fn).toThrow();

            const expected = expectedFn(new NodeExpectContext(actual));

            // check the thrown error
            const error = fn.mock.results[0].value;
            expect(error).toBeInstanceOf(AdblockSyntaxError);
            expect(error).toHaveProperty('message', expected.message);
            expect(error).toHaveProperty('start', expected.start);
            expect(error).toHaveProperty('end', expected.end);
        });
    });

    describe('AbpSnippetInjectionBodyParser.generate', () => {
        test.each<{ actual: string; expected: string }>([
            {
                actual: String.raw`scriptlet0`,
                expected: String.raw`scriptlet0`,
            },
            {
                actual: String.raw`scriptlet0 arg0`,
                expected: String.raw`scriptlet0 arg0`,
            },

            {
                actual: String.raw`scriptlet0 arg0 arg1`,
                expected: String.raw`scriptlet0 arg0 arg1`,
            },
            {
                actual: String.raw`scriptlet0 arg0_0\ arg0_1 arg1`,
                expected: String.raw`scriptlet0 arg0_0\ arg0_1 arg1`,
            },

            {
                actual: String.raw`scriptlet0 arg0 arg1;`,
                expected: String.raw`scriptlet0 arg0 arg1`, // ; disappears
            },
            {
                actual: String.raw`scriptlet0 'arg0 arg1;`,
                expected: String.raw`scriptlet0 'arg0 arg1;`, // ; is considered as a part of the argument
            },
            {
                actual: String.raw`scriptlet0 "arg0 arg1;`,
                expected: String.raw`scriptlet0 "arg0 arg1;`, // ; is considered as a part of the argument
            },
            {
                actual: String.raw`scriptlet0 some'thing'`,
                expected: String.raw`scriptlet0 some'thing'`,
            },
            {
                actual: String.raw`scriptlet0 arg00 arg01; scriptlet1; scriptlet2 arg20`,
                expected: String.raw`scriptlet0 arg00 arg01; scriptlet1; scriptlet2 arg20`,
            },
            /* eslint-disable max-len */
            {
                actual: String.raw`scriptlet0 arg00 /a;b/ 'a;b' "a;b"; scriptlet-1; scriptlet2 'arg20' arg21\ something;`,
                expected: String.raw`scriptlet0 arg00 /a;b/ 'a;b' "a;b"; scriptlet-1; scriptlet2 'arg20' arg21\ something`, // ; disappears
            },
            {
                actual: String.raw`hide-if-matches-xpath './/*[@class="test-xpath-class"]'; hide-if-matches-xpath './/div[@id="aaa"]//div[starts-with(@id,"aaa")][.//h1//span/text()="aaa"]'; hide-if-matches-xpath './/div[@id="bbb"]//div[starts-with(@id,"bbb")][.//h1//span/text()="bbb"]'`,
                expected: String.raw`hide-if-matches-xpath './/*[@class="test-xpath-class"]'; hide-if-matches-xpath './/div[@id="aaa"]//div[starts-with(@id,"aaa")][.//h1//span/text()="aaa"]'; hide-if-matches-xpath './/div[@id="bbb"]//div[starts-with(@id,"bbb")][.//h1//span/text()="bbb"]'`,
            },
            {
                actual: String.raw`race start; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ 'div[role=feed] div[role=article]' a[href="#"][role="link"]; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ 'div[role=feed] div[role=article]' a[href^="?__cft__"]; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ 'div[role=feed] div[role=article]' a[href="#"][role="link"]>span>span>b; hide-if-matches-xpath './/div[@role="feed"]//div[@role="article"]//a[@aria-label[.="Patrocinado" or .="Sponsa" or .="Bersponsor" or .="Commandité" or .="Ditaja" or .="Gesponsert" or .="Gesponsord" or .="Sponsrad" or .="Publicidad" or .="Sponsoreret" or .="Sponset" or .="Sponsored" or .="Sponsorisé" or .="Sponsorizat" or .="Sponsorizzato" or .="Sponsorlu" or .="Sponsorowane" or .="Реклама" or .="ממומן" or .="تمويل شوي" or .="دارای پشتیبانی مالی" or .="سپانسرڈ" or .="مُموَّل" or .="प्रायोजित" or .="সৌজন্যে" or .="ได้รับการสนับสนุน" or .="内容" or .="贊助" or .="Sponsoroitu" or .="May Sponsor" or .="Được tài trợ"]]/ancestor::div[@role="article"]'; race stop;`,
                expected: String.raw`race start; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ 'div[role=feed] div[role=article]' a[href="#"][role="link"]; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ 'div[role=feed] div[role=article]' a[href^="?__cft__"]; hide-if-contains-visible-text /[Sponsred]{9}|[Gesponrtd]{10}|[Sponrisé]{10}|[Comandité]{9}|[Publicda]{10}|[Sponsrwae]{12}|[Patrocind]{11}|[Sponsrizat]{13}/ 'div[role=feed] div[role=article]' a[href="#"][role="link"]>span>span>b; hide-if-matches-xpath './/div[@role="feed"]//div[@role="article"]//a[@aria-label[.="Patrocinado" or .="Sponsa" or .="Bersponsor" or .="Commandité" or .="Ditaja" or .="Gesponsert" or .="Gesponsord" or .="Sponsrad" or .="Publicidad" or .="Sponsoreret" or .="Sponset" or .="Sponsored" or .="Sponsorisé" or .="Sponsorizat" or .="Sponsorizzato" or .="Sponsorlu" or .="Sponsorowane" or .="Реклама" or .="ממומן" or .="تمويل شوي" or .="دارای پشتیبانی مالی" or .="سپانسرڈ" or .="مُموَّل" or .="प्रायोजित" or .="সৌজন্যে" or .="ได้รับการสนับสนุน" or .="内容" or .="贊助" or .="Sponsoroitu" or .="May Sponsor" or .="Được tài trợ"]]/ancestor::div[@role="article"]'; race stop`, // ; disappears
            },
            /* eslint-enable max-len */
        ])("should generate '$expected' from '$actual'", ({ actual, expected }) => {
            const ruleNode = AbpSnippetInjectionBodyParser.parse(actual);

            if (ruleNode === null) {
                throw new Error(`Failed to parse '${actual}' as cosmetic rule`);
            }

            expect(AbpSnippetInjectionBodyGenerator.generate(ruleNode)).toBe(expected);
        });
    });

    describe('serialize & deserialize', () => {
        test.each([
            'scriptlet0',
            'scriptlet0 arg0',
            'scriptlet0 arg0 arg1',
            'scriptlet0 arg00 arg01; scriptlet1; scriptlet2 arg20',
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(
                AbpSnippetInjectionBodyParser,
                AbpSnippetInjectionBodyGenerator,
                AbpSnippetInjectionBodySerializer,
                AbpSnippetInjectionBodyDeserializer,
            );
        });
    });
});
