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
});
