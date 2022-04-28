import { DeclarativeConverter } from '../../../src/rules/declarative-converter/declarative-converter';
import { StringRuleList } from '../../../src/filterlist/rule-list';

const createRuleList = (rules: string[]) => new StringRuleList(1, rules.join('\n'), false);

describe('DeclarativeConverter', () => {
    const declarativeConverter = new DeclarativeConverter();

    it('converts simple blocking rules', () => {
        const result = declarativeConverter.convert(createRuleList(['||example.org^']));

        expect(result).toHaveLength(1);
        expect(result).toContainEqual({
            id: 1,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                isUrlFilterCaseSensitive: false,
            },
        });
    });

    it('respects badfilter rules', () => {
        const result = declarativeConverter.convert(createRuleList([
            '||example.org^',
            '||example.org^$badfilter',
            '||persistent.com^',
        ]));

        expect(result).toHaveLength(1);
        expect(result).toContainEqual({
            id: 41,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||persistent.com^',
                isUrlFilterCaseSensitive: false,
            },
        });
    });

    it('skips some inapplicable rules', () => {
        const result = declarativeConverter.convert(createRuleList([
            '||example.org^$badfilter',
            '@@||example.org^$elemhide',
        ]));

        expect(result).toHaveLength(0);
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
