import { describe, expect, it } from 'vitest';
import { findNextLineBreakIndex } from 'tsurlfilter-v3';

import { Filter } from '../../../src/rules/declarative-converter';
import { ConvertedFilterList } from '../../../src/filterlist/converted-filter-list';

describe('Filter', () => {
    // NOTE: Testing filter SHOULD contain some of convertible while
    // preprocessing rules.
    const rules = [
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
    ];
    const text = rules.join('\r\n');

    it('loads content from string source provider', async () => {
        const filter = new Filter(
            1,
            { getContent: async () => new ConvertedFilterList(text) },
            true,
        );

        const loadedContent = await filter.getContent();

        expect(loadedContent.getOriginalContent()).toStrictEqual(text);
    });

    it('returns original rule by index', async () => {
        const filter = new Filter(
            1,
            { getContent: async () => new ConvertedFilterList(text) },
            true,
        );

        const convertedFilter = await filter.getContent();
        const content = convertedFilter.getContent();
        const { length } = content;
        const indices: number[] = [];

        let i = 0;

        while (i < length) {
            indices.push(i);
            const [nextLineBreakIndex, nextLineBreakLength] = findNextLineBreakIndex(content, i);
            i = nextLineBreakIndex + nextLineBreakLength;
        }

        const retrievedRules = await Promise.all(
            indices.map(async (index) => convertedFilter.getOriginalRuleText(index)),
        );

        expect(retrievedRules).toStrictEqual(rules);
    });

    it('unloads content correctly', async () => {
        const filter = new Filter(
            1,
            { getContent: async () => new ConvertedFilterList(text) },
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
            { getContent: async () => new ConvertedFilterList(text) },
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
        expect(newContent.getOriginalContent()).toStrictEqual(text);
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
        resolveFetch!(new ConvertedFilterList(text));

        // Ensure content is still correctly unloaded after the fetch completes
        await contentPromise;

        expect(Object.getOwnPropertyDescriptor(filter, 'content')?.value).toBeNull();
    });

    it('prevents memory leaks by resetting contentLoadingPromise', async () => {
        const filter = new Filter(
            1,
            { getContent: async () => new ConvertedFilterList(text) },
            true,
        );

        await filter.getContent();

        expect(Object.getOwnPropertyDescriptor(filter, 'contentLoadingPromise')?.value).toBeNull();

        filter.unloadContent();

        expect(Object.getOwnPropertyDescriptor(filter, 'contentLoadingPromise')?.value).toBeNull();
    });
});
