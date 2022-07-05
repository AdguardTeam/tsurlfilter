import { DeclarativeConverter } from '../../../src/rules/declarative-converter/declarative-converter';
import { StringRuleList } from '../../../src/filterlist/rule-list';

const createRuleList = (rules: string[]) => new StringRuleList(1, rules.join('\n'), false);

describe('DeclarativeConverter', () => {
    const declarativeConverter = new DeclarativeConverter();

    it('converts simple blocking rules', () => {
        const {
            declarativeRules,
            convertedSourceMap,
        } = declarativeConverter.convert(createRuleList(['||example.org^']));

        const generatedId = 1;
        const positionRuleInList = 0;

        expect(declarativeRules).toHaveLength(1);
        expect(declarativeRules).toContainEqual({
            id: generatedId,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                isUrlFilterCaseSensitive: false,
            },
        });

        expect(Array.from(convertedSourceMap.entries())).toHaveLength(1);
        expect(convertedSourceMap.get(generatedId)).toBe(positionRuleInList);
    });

    it('respects badfilter rules', () => {
        const {
            declarativeRules,
            convertedSourceMap,
        } = declarativeConverter.convert(createRuleList([
            '||example.org^',
            '||example.org^$badfilter',
            '||persistent.com^',
        ]));

        const generatedId = 41;
        const positionRuleInList = 40;

        expect(declarativeRules).toHaveLength(1);
        expect(declarativeRules).toContainEqual({
            id: 41,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||persistent.com^',
                isUrlFilterCaseSensitive: false,
            },
        });

        expect(Array.from(convertedSourceMap.entries())).toHaveLength(1);
        expect(convertedSourceMap.get(generatedId)).toBe(positionRuleInList);
    });

    it('skips some inapplicable rules', () => {
        const {
            declarativeRules,
            convertedSourceMap,
        } = declarativeConverter.convert(createRuleList([
            '||example.org^$badfilter',
            '@@||example.org^$elemhide',
        ]));

        expect(declarativeRules).toHaveLength(0);
        expect(Array.from(convertedSourceMap.entries())).toHaveLength(0);
    });

    it('maximum allowed regex rules count reached', () => {
        expect(() => {
            declarativeConverter.convert(createRuleList([
                '/.s/src/[a-z0-9]*.js/$domain=plasma.3dn.ru',
                '/dbp/pre/$script,third-party',
                '/wind10.ru/w*.js/$domain=wind10.ru,',
            ]), {
                maxLimit: 5000,
                maxRegexLimit: 2,
            });
        }).toThrowError();
    });
});
