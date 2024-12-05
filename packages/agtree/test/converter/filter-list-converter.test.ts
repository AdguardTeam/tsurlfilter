import { FilterListParser } from '../../src/parser/filterlist';
import { NEWLINE } from '../../src/utils/constants';
import { FilterListConverter } from '../../src/converter/filter-list';

describe('FilterListConverter', () => {
    test('convertToAdg should leave non-affected filter lists as is', () => {
        const filterListContent = [
            '! Title: Foo',
            '! Description: Bar',
            '! Expires: 1 day',
            '! Homepage: https://example.com',
            '! Version: 1',
            '! License: https://example.com/license',
            '||example.com^$script',
        ].join(NEWLINE);

        const filterListNode = FilterListParser.parse(filterListContent);
        const convertedFilterList = FilterListConverter.convertToAdg(filterListNode);

        // Converted filter list should be the same as the original one
        expect(convertedFilterList.result.children).toHaveLength(filterListNode.children.length);
        expect(FilterListParser.generate(convertedFilterList.result)).toBe(filterListContent);

        // Rule object references should be the same
        convertedFilterList.result.children.forEach((rule, index) => {
            // TODO: Add deep check for properties, eg domain list
            expect(rule).toBe(filterListNode.children[index]);
        });
    });

    test('convertToAdg should convert filter lists to AdGuard syntax', () => {
        // We don't need to test all possible rule types here, since we already
        // have tests for RuleConverter.convertToAdg
        const filterListContent = [
            '! Title: Foo',
            '! Description: Bar',
            '! Expires: 1 day',
            '! Homepage: https://example.com',
            '! Version: 1',
            '! License: https://example.com/license',
            '||example.com^$script',
            // ---
            '||googletagservices.com/test.js$domain=test.com,redirect=googletagservices_gpt.js',
            '||delivery.tf1.fr/pub$media,rewrite=abp-resource:blank-mp3,domain=tf1.fr',
            'example.com#$#abp-snippet1 arg0 arg1; abp-snippet2 arg0 arg1',
            '##^script:has-text(ad)',
        ].join(NEWLINE);

        const expectedFilterListContent = [
            '! Title: Foo',
            '! Description: Bar',
            '! Expires: 1 day',
            '! Homepage: https://example.com',
            '! Version: 1',
            '! License: https://example.com/license',
            '||example.com^$script',
            // ---
            '||googletagservices.com/test.js$domain=test.com,redirect=googletagservices-gpt',
            '||delivery.tf1.fr/pub$media,redirect=noopmp3-0.1s,domain=tf1.fr',
            "example.com#%#//scriptlet('abp-snippet1', 'arg0', 'arg1')",
            "example.com#%#//scriptlet('abp-snippet2', 'arg0', 'arg1')",
            '$$script[tag-content="ad"][max-length="262144"]',
        ].join(NEWLINE);

        const filterListNode = FilterListParser.parse(filterListContent);
        const convertedFilterList = FilterListConverter.convertToAdg(filterListNode);

        // Filter list node references should be different
        expect(convertedFilterList.result).not.toBe(filterListNode);

        // Serialized filter lists should be equal with the expected one
        expect(FilterListParser.generate(convertedFilterList.result)).toBe(expectedFilterListContent);

        // Rule object references should be different
        convertedFilterList.result.children.forEach((convertedRule) => {
            // TODO: Add deep check for properties, eg domain list
            filterListNode.children.forEach((originalRule) => {
                if (originalRule === convertedRule) {
                    throw new Error('Rule object references should be different');
                }
            });
        });
    });

    test('Tolerant mode should work correctly', () => {
        const filterListContent = [
            '! Title: Foo',
            // ADG HTML filtering doesn't support CSS combinator, so this rule will be invalid
            '##^body > script:has-text(foo)',
            // Should be converted
            '||example.com^$3p',
        ].join(NEWLINE);

        // Expected tolerantly converted filter list
        const expectedFilterListContent = [
            '! Title: Foo',
            '##^body > script:has-text(foo)', // Left as is
            '||example.com^$third-party', // Converted
        ].join(NEWLINE);

        const filterListNode = FilterListParser.parse(filterListContent);

        // Without tolerant mode, the whole filter list should fail
        expect(() => FilterListConverter.convertToAdg(filterListNode, false)).toThrow();

        // With tolerant mode, the whole filter list should be converted
        const tolerant = () => FilterListConverter.convertToAdg(filterListNode, true);
        expect(tolerant).not.toThrow();

        // The rule should be left as is
        expect(FilterListParser.generate(tolerant().result)).toBe(expectedFilterListContent);
    });
});
