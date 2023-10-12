import { Filter } from '../../../src/rules/declarative-converter';

describe('Filter', () => {
    const content = '||example.com^$document\r\n||example.net^\r\n@@||example.io^';
    const splittedContent = content.split(/\r?\n/);

    it('loads content from string source provider', async () => {
        const filter = new Filter(1, {
            getContent: async () => splittedContent,
        });

        const loadedContent = await filter.getContent();

        expect(loadedContent).toStrictEqual(splittedContent);
    });

    it('returns original rule by index', async () => {
        const filter = new Filter(1, {
            getContent: async () => splittedContent,
        });

        const secondRule = await filter.getRuleByIndex(1);

        expect(secondRule).toStrictEqual(splittedContent[1]);
    });
});
