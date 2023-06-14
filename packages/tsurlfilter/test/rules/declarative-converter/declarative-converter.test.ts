import { DeclarativeFilterConverter } from '../../../src/rules/declarative-converter/filter-converter';
import { Filter } from '../../../src/rules/declarative-converter/filter';
import { TooManyRulesError } from '../../../src/rules/declarative-converter/errors/limitation-errors';
import {
    EmptyOrNegativeNumberOfRulesError,
    ResourcesPathError,
} from '../../../src/rules/declarative-converter/errors/converter-options-errors';

const createFilter = (
    rules: string[],
    filterId: number = 0,
) => {
    return new Filter(
        filterId,
        { getContent: () => Promise.resolve(rules) },
    );
};

describe('DeclarativeConverter', () => {
    const converter = new DeclarativeFilterConverter();

    it('converts simple blocking rule', async () => {
        const filter = createFilter(['||example.org^']);
        const { ruleSets: [ruleSet] } = await converter.convert(
            [filter],
        );
        const { declarativeRules } = await ruleSet.serialize();

        const ruleId = 1;

        expect(declarativeRules).toHaveLength(1);
        expect(declarativeRules[0]).toStrictEqual({
            id: ruleId,
            action: { type: 'block' },
            condition: {
                urlFilter: '||example.org^',
                isUrlFilterCaseSensitive: false,
            },
            priority: 1,
        });
    });

    it('converts simple blocking regexp rule', async () => {
        const filter = createFilter(['/banner\\d+/$third-party']);
        const { ruleSets: [ruleSet] } = await converter.convert(
            [filter],
        );
        const { declarativeRules } = await ruleSet.serialize();

        const ruleId = 1;

        expect(declarativeRules).toHaveLength(1);
        expect(declarativeRules[0]).toEqual({
            id: ruleId,
            action: { type: 'block' },
            condition: {
                regexFilter: '/banner\\d+/',
                domainType: 'thirdParty',
                isUrlFilterCaseSensitive: false,
            },
            priority: 2,
        });
    });

    describe('respects badfilter rules', () => {
        it('applies $badfilter to one filter', async () => {
            const filter = createFilter([
                '||example.org^',
                '||example.org^$badfilter',
                '||persistent.com^',
            ]);
            const { ruleSets: [ruleSet] } = await converter.convert(
                [filter],
            );
            const { declarativeRules } = await ruleSet.serialize();

            const ruleId = 3;

            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: ruleId,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||persistent.com^',
                    isUrlFilterCaseSensitive: false,
                },
                priority: 1,
            });
        });

        it('applies badfilter to multiple filters', async () => {
            const filter = createFilter([
                '||example.org^',
            ], 0);
            const filter2 = createFilter([
                '||example.com^',
                '||example.com^$badfilter',
                '||example.org^$badfilter',
                '||persistent.com^',
            ], 1);
            const filter3 = createFilter([
                '||example.org^$badfilter',
            ], 2);
            const {
                ruleSets: [ruleSet],
            } = await converter.convertToSingle([
                filter, filter2, filter3,
            ]);
            const { declarativeRules } = await ruleSet.serialize();

            const ruleId = 4;

            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: ruleId,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||persistent.com^',
                    isUrlFilterCaseSensitive: false,
                },
                priority: 1,
            });
        });
    });

    it('skips some inapplicable rules', async () => {
        const filter = createFilter([
            '||example.org^$badfilter',
            '@@||example.org^$elemhide',
        ]);
        const { ruleSets: [ruleSet] } = await converter.convert(
            [filter],
        );
        const { declarativeRules } = await ruleSet.serialize();

        expect(declarativeRules).toHaveLength(0);
    });

    it('respects document, urlblock modifiers', async () => {
        const filter = createFilter([
            '@@||example.org^$document',
            '@@||example.com^$urlblock',
        ]);
        const { ruleSets: [ruleSet] } = await converter.convert(
            [filter],
        );
        const { declarativeRules } = await ruleSet.serialize();

        expect(declarativeRules).toHaveLength(2);
        expect(declarativeRules[0]).toStrictEqual({
            id: 1,
            priority: 140101,
            action: { type: 'allowAllRequests' },
            condition: {
                isUrlFilterCaseSensitive: false,
                resourceTypes: ['main_frame'],
                urlFilter: '||example.org^',
            },
        });
        expect(declarativeRules[1]).toEqual({
            id: 2,
            priority: 110076,
            action: { type: 'allowAllRequests' },
            condition: {
                isUrlFilterCaseSensitive: false,
                resourceTypes: ['main_frame', 'sub_frame'],
                urlFilter: '||example.com^',
            },
        });
    });

    it('returns original rule text for specified declarative rule', async () => {
        const rules = [
            '||testcases.adguard.com$xmlhttprequest,removeparam=p1case1',
            '||testcases.adguard.com$xmlhttprequest,removeparam=p2case1',
            '||testcases.adguard.com$xmlhttprequest,removeparam=P3Case1',
        ];
        const additionalRule = '$xmlhttprequest,removeparam=p1case2';
        const filter = createFilter([
            ...rules,
            additionalRule,
        ]);
        const { ruleSets: [ruleSet] } = await converter.convert([filter]);

        let sources = await ruleSet.getRulesById(1);
        const originalRules = sources.map(({ sourceRule }) => sourceRule);
        expect(originalRules).toEqual(expect.arrayContaining(rules));

        sources = await ruleSet.getRulesById(4);
        expect(sources[0].sourceRule).toEqual(additionalRule);
    });

    describe('respects limitations', () => {
        it('work with max number of rules in one filter', async () => {
            const filter = createFilter([
                '||example.org^',
                '||example.com^',
                '||example.net^',
            ]);

            const { ruleSets: [ruleSet] } = await converter.convert(
                [filter],
                { maxNumberOfRules: 2 },
            );
            const { declarativeRules } = await ruleSet.serialize();

            expect(declarativeRules).toHaveLength(2);
            expect(declarativeRules[0]).toStrictEqual({
                id: 1,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.org^',
                    isUrlFilterCaseSensitive: false,
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: 2,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.com^',
                    isUrlFilterCaseSensitive: false,
                },
            });
        });

        it('work with max number of rules in many filter', async () => {
            const filter1 = createFilter([
                '||example.org^',
                '||example.com^',
                '||example.net^',
            ], 0);
            const filter2 = createFilter([
                '||example.co.uk^',
                '||example.io^',
            ], 1);

            const { ruleSets: [ruleSet] } = await converter.convertToSingle(
                [filter1, filter2],
                { maxNumberOfRules: 4 },
            );
            const { declarativeRules } = await ruleSet.serialize();

            expect(declarativeRules).toHaveLength(4);
            expect(declarativeRules[0]).toStrictEqual({
                id: 1,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.org^',
                    isUrlFilterCaseSensitive: false,
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: 2,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.com^',
                    isUrlFilterCaseSensitive: false,
                },
            });
            expect(declarativeRules[2]).toStrictEqual({
                id: 3,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.net^',
                    isUrlFilterCaseSensitive: false,
                },
            });
            expect(declarativeRules[3]).toStrictEqual({
                id: 4,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.co.uk^',
                    isUrlFilterCaseSensitive: false,
                },
            });
        });

        it('work with max number of regexp rules', async () => {
            const filter = createFilter([
                '/.s/src/[a-z0-9]*.js/$domain=plasma.3dn.ru',
                '/dbp/pre/$script,third-party',
                '/wind10.ru/w*.js/$domain=wind10.ru,',
            ]);

            const { ruleSets: [ruleSet] } = await converter.convert(
                [filter],
                { maxNumberOfRules: 2 },
            );
            const { declarativeRules } = await ruleSet.serialize();

            expect(declarativeRules).toHaveLength(2);
            expect(declarativeRules[0]).toStrictEqual({
                id: 1,
                priority: 201,
                action: { type: 'block' },
                condition: {
                    initiatorDomains: ['plasma.3dn.ru'],
                    isUrlFilterCaseSensitive: false,
                    regexFilter: '/.s/src/[a-z0-9]*.js/',
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: 2,
                priority: 102,
                action: { type: 'block' },
                condition: {
                    domainType: 'thirdParty',
                    regexFilter: '/dbp/pre/',
                    resourceTypes: ['script'],
                    isUrlFilterCaseSensitive: false,
                },
            });
        });

        it('return limitations errors', async () => {
            const filter = createFilter([
                '||example.org^',
                '||example.com^',
                '||example.net^',
            ]);

            const maxNumberOfRules = 2;

            const {
                ruleSets: [ruleSet],
                limitations,
            } = await converter.convert(
                [filter],
                { maxNumberOfRules },
            );
            const { declarativeRules } = await ruleSet.serialize();

            expect(declarativeRules).toHaveLength(2);
            expect(declarativeRules[0]).toStrictEqual({
                id: 1,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.org^',
                    isUrlFilterCaseSensitive: false,
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: 2,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    urlFilter: '||example.com^',
                    isUrlFilterCaseSensitive: false,
                },
            });

            const msg = 'After conversion, too many declarative rules remain: '
                + '3 exceeds the limit provided - 2';
            const err = new TooManyRulesError(msg, [2], maxNumberOfRules, 1);

            expect(limitations).toHaveLength(1);
            expect(limitations[0]).toStrictEqual(err);
        });
    });

    describe('checks convert options', () => {
        it('throws error when empty resources path provided', async () => {
            const filter = createFilter(['||example.org^']);
            const resourcesPath = '';
            const convert = async () => {
                await converter.convert([filter], { resourcesPath });
            };

            const msg = 'Path to web accessible resources should '
                + `be started with leading slash: ${resourcesPath}`;
            await expect(convert).rejects.toThrow(new ResourcesPathError(msg));
        });

        it('throws error if the resources path started with a slash', async () => {
            const filter = createFilter(['||example.org^']);
            const resourcesPath = 'path';
            const convert = async () => {
                await converter.convert([filter], { resourcesPath });
            };

            const msg = 'Path to web accessible resources should '
                + `be started with leading slash: ${resourcesPath}`;
            await expect(convert).rejects.toThrow(new ResourcesPathError(msg));
        });

        it('throws error if the resources path ended with a slash', async () => {
            const filter = createFilter(['||example.org^']);
            const resourcesPath = '/path/';
            const convert = async () => {
                await converter.convert([filter], { resourcesPath });
            };

            const msg = 'Path to web accessible resources should '
                + `not be ended with slash: ${resourcesPath}`;
            await expect(convert).rejects.toThrow(new ResourcesPathError(msg));
        });

        it('throws error if the maximum number of rules is equal to or less than 0', async () => {
            const filter = createFilter(['||example.org^']);
            const maxNumberOfRules = 0;
            const convert = async () => {
                await converter.convert([filter], { maxNumberOfRules });
            };

            const msg = 'Maximum number of rules cannot be equal or less than 0';
            await expect(convert).rejects.toThrow(new EmptyOrNegativeNumberOfRulesError(msg));
        });

        it('throws error if the maximum number of regexp rules is less than 0', async () => {
            const filter = createFilter(['||example.org^']);
            const maxNumberOfRegexpRules = -1;
            const convert = async () => {
                await converter.convert([filter], { maxNumberOfRegexpRules });
            };

            const msg = 'Maximum number of regexp rules cannot be less than 0';
            await expect(convert).rejects.toThrow(new EmptyOrNegativeNumberOfRulesError(msg));
        });
    });
});
