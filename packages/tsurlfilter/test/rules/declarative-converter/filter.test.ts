import { describe, expect, it } from 'vitest';

import { FilterListPreprocessor } from '../../../src/filterlist/preprocessor';
import { Filter } from '../../../src/rules/declarative-converter';

describe('Filter', () => {
    // NOTE: Testing filter SHOULD contain some of convertible while
    // preprocessing rules.
    const rawContent = [
        '||example.com^$document',
        '||example.net^',
        '@@||example.io^',
        // eslint-disable-next-line max-len
        '||googletagmanager.com/gtm.js$script,xmlhttprequest,redirect=googletagmanager-gtm,domain=einthusan.ca|einthusan.tv|einthusan.com',
        '||googletagmanager.com/gtm.js$script,redirect=googletagmanager-gtm,domain=lastampa.it',
        // eslint-disable-next-line max-len
        'samnytt.se#@#div[class=""], a, .sticky > div[style="display:grid"], .post-content > div.mx-auto:has-text(/annons/i)',
        'wolt.com##button:has(> div > div > div > span:has-text(Sponsored))',
        '4wank.com#?#.video-holder > center > :-abp-contains(/^Advertisement$/)',
    ].join('\r\n');

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

        // TODO: It looks like poor design: it is not obvious that we should save
        // and operate preprocessed filter content, but not raw original one. AG-37306
        const preprocessedContent = preprocessedFilter.rawFilterList.split('\r\n');

        expect(rules).toStrictEqual(preprocessedContent);
    });

    it('unloads content correctly', async () => {
        const filter = new Filter(
            1,
            { getContent: async () => FilterListPreprocessor.preprocess(rawContent) },
            true,
        );

        // Load content
        await filter.getContent();

        expect(Object.getOwnPropertyDescriptor(filter, 'content')?.value).not.toBeNull();

        // Unload content
        filter.unloadContent();
        expect(Object.getOwnPropertyDescriptor(filter, 'content')?.value).toBeNull();
    });

    it('does not return stale content after unload', async () => {
        const filter = new Filter(
            1,
            { getContent: async () => FilterListPreprocessor.preprocess(rawContent) },
            true,
        );

        // Load content
        await filter.getContent();

        expect(Object.getOwnPropertyDescriptor(filter, 'content')?.value).not.toBeNull();

        // Unload content
        filter.unloadContent();
        expect(Object.getOwnPropertyDescriptor(filter, 'content')?.value).toBeNull();

        // Reload content after unloading
        const newContent = await filter.getContent();
        expect(FilterListPreprocessor.getOriginalFilterListText(newContent)).toStrictEqual(rawContent);
    });

    it('waits for content to load before unloading', async () => {
        let resolveFetch: (content: any) => void;

        const fetchPromise = new Promise((resolve) => {
            resolveFetch = resolve;
        });

        const filter = new Filter(
            1,
            { getContent: async () => fetchPromise as any },
            true,
        );

        // Start loading content
        const contentPromise = filter.getContent();

        // Call unloadContent while content is still loading
        filter.unloadContent();

        // Resolve content fetch
        resolveFetch!(FilterListPreprocessor.preprocess(rawContent));

        // Ensure content is still correctly unloaded after the fetch completes
        await contentPromise;

        expect(Object.getOwnPropertyDescriptor(filter, 'content')?.value).toBeNull();
    });

    it('prevents memory leaks by resetting contentLoadingPromise', async () => {
        const filter = new Filter(
            1,
            { getContent: async () => FilterListPreprocessor.preprocess(rawContent) },
            true,
        );

        await filter.getContent();

        expect(Object.getOwnPropertyDescriptor(filter, 'contentLoadingPromise')?.value).toBeNull();

        filter.unloadContent();

        expect(Object.getOwnPropertyDescriptor(filter, 'contentLoadingPromise')?.value).toBeNull();
    });
});
