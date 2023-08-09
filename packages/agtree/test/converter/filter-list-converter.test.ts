import { FilterListParser } from '../../src/parser/filterlist';
import { NEWLINE } from '../../src/utils/constants';
import { FilterListConverter } from '../../src/converter/filter-list';
import { RuleParser } from '../../src/parser/rule';

describe('FilterListConverter', () => {
    test('convertToAdg should convert filter list to AdGuard format', () => {
        // We don't need to test all possible rule types here, since we already
        // have tests for RuleConverter.convertToAdg
        const filterListRules = [
            '||googletagservices.com/test.js$domain=test.com,redirect=googletagservices_gpt.js',
            '||delivery.tf1.fr/pub$media,rewrite=abp-resource:blank-mp3,domain=tf1.fr',
            'example.com#$#abp-snippet1 arg0 arg1; abp-snippet2 arg0 arg1',
            '##^script:has-text(ad)',
        ];

        const expectedRules = [
            '||googletagservices.com/test.js$domain=test.com,redirect=googletagservices-gpt',
            '||delivery.tf1.fr/pub$media,redirect=noopmp3-0.1s,domain=tf1.fr',
            "example.com#%#//scriptlet('abp-snippet1', 'arg0', 'arg1')",
            "example.com#%#//scriptlet('abp-snippet2', 'arg0', 'arg1')",
            '$$script[tag-content="ad"][max-length="262144"]',
        ];

        const filterListNode = FilterListParser.parse(filterListRules.join(NEWLINE));
        const convertedFilterListNode = FilterListConverter.convertToAdg(filterListNode);
        expect(convertedFilterListNode.children.map(RuleParser.generate)).toEqual(expectedRules);
    });
});
