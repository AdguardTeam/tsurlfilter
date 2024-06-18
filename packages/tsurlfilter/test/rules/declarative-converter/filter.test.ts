import { RuleParser } from '@adguard/agtree';

import { Filter } from '../../../src/rules/declarative-converter';

describe('Filter', () => {
    const content = '||example.com^$document\r\n||example.net^\r\n@@||example.io^';
    const splittedContent = content.split(/\r?\n/);

    it('loads content from string source provider', async () => {
        const filter = new Filter(1, {
            getContent: async () => splittedContent.map((rule) => RuleParser.parse(rule)),
        });

        const loadedContent = await filter.getContent();

        expect(loadedContent).toStrictEqual(splittedContent.map((rule) => RuleParser.parse(rule)));
    });

    it('returns original rule by index', async () => {
        const filter = new Filter(1, {
            getContent: async () => splittedContent.map((rule) => RuleParser.parse(rule)),
        });

        const secondRule = await filter.getRuleByIndex(1);

        expect(secondRule).toStrictEqual(RuleParser.parse(splittedContent[1]));
    });
});
