import { FilterListPreprocessor } from '../../../src';
import { Filter } from '../../../src/rules/declarative-converter';

describe('Filter', () => {
    const rawContent = '||example.com^$document\r\n||example.net^\r\n@@||example.io^';

    it('loads content from string source provider', async () => {
        const filter = new Filter(1, {
            getContent: async () => FilterListPreprocessor.preprocess(rawContent),
        });

        const loadedContent = await filter.getContent();

        expect(FilterListPreprocessor.getOriginalFilterListText(loadedContent)).toStrictEqual(rawContent);
    });

    it('returns original rule by index', async () => {
        const filter = new Filter(1, {
            getContent: async () => FilterListPreprocessor.preprocess(rawContent),
        });

        const content = await filter.getContent();

        const indexes = Object.keys(content.sourceMap).map(Number);
        const rules = await Promise.all(indexes.map(async (index) => filter.getRuleByIndex(index)));
        const rawContentSplitted = rawContent.split('\r\n');

        expect(rules).toStrictEqual(rawContentSplitted);
    });
});
