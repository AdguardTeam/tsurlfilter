import { FilterListPreprocessor } from '../../../src';
import { Filter } from '../../../src/rules/declarative-converter';

describe('Filter', () => {
    // NOTE: Testing filter SHOULD contain some of convertible while
    // preprocessing rules.
    // eslint-disable-next-line max-len
    const rawContent = '||example.com^$document\r\n||example.net^\r\n@@||example.io^\r\n||googletagmanager.com/gtm.js$script,xmlhttprequest,redirect=googletagmanager-gtm,domain=einthusan.ca|einthusan.tv|einthusan.com\r\n||googletagmanager.com/gtm.js$script,redirect=googletagmanager-gtm,domain=lastampa.it\r\nsamnytt.se#@#div[class=""], a, .sticky > div[style="display:grid"], .post-content > div.mx-auto:has-text(/annons/i)\r\nwolt.com##button:has(> div > div > div > span:has-text(Sponsored))\r\n4wank.com#?#.video-holder > center > :-abp-contains(/^Advertisement$/)';

    it('loads content from string source provider', async () => {
        const filter = new Filter(
            1,
            { getContent: async () => FilterListPreprocessor.preprocess(rawContent) },
            true,
        );

        const loadedContent = await filter.getContent();

        expect(FilterListPreprocessor.getOriginalFilterListText(loadedContent)).toStrictEqual(rawContent);
    });

    it('returns original rule by index', async () => {
        const filter = new Filter(
            1,
            { getContent: async () => FilterListPreprocessor.preprocess(rawContent) },
            true,
        );

        const preprocessedFilter = await filter.getContent();

        const indexes = Object.keys(preprocessedFilter.sourceMap).map(Number);
        const rules = await Promise.all(indexes.map(async (index) => filter.getRuleByIndex(index)));

        // FIXME: It looks like poor design: it is not obvious that we should save
        // and operate preprocessed filter content, but not raw original one.
        const preprocessedContent = preprocessedFilter.rawFilterList.split('\r\n');

        expect(rules).toStrictEqual(preprocessedContent);
    });
});
