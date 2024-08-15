import { FilterListPreprocessor, getRuleSourceIndex, getRuleSourceText } from '../../../src';
import { Filter } from '../../../src/rules/declarative-converter';

const fs = require('fs');
const path = require('path');

// FIXME: These tests will failed.
describe('Filter', () => {
    // FIXME: Find another solution to load file content without storing large file.
    const textFile = fs.readFileSync(path.resolve(__dirname, './filter_2.txt'));
    const rawContent = textFile.toString();

    it('loads content from string source provider', async () => {
        const filter = new Filter(
            1,
            { getContent: async () => FilterListPreprocessor.preprocess(rawContent) },
            true,
        );

        const loadedContent = await filter.getContent();

        expect(loadedContent.rawFilterList).toStrictEqual(rawContent);
    });

    it('returns original rule by index', async () => {
        const filter = new Filter(
            1,
            { getContent: async () => FilterListPreprocessor.preprocess(rawContent) },
            true,
        );

        const content = await filter.getContent();

        const indexes = Object.keys(content.sourceMap).map(Number);

        for (let i = 0; i < indexes.length; i += 1) {
            const index = indexes[i];
            const value = content.sourceMap[index];

            const lineIndex = getRuleSourceIndex(index, content.sourceMap);
            const sourceRule = getRuleSourceText(lineIndex, content.rawFilterList);

            expect(sourceRule).toStrictEqual(rawContent.slice(value, value + sourceRule!.length));
        }
    });
});
