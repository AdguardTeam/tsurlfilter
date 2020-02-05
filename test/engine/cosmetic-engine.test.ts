import { CosmeticEngine } from '../../src/engine/cosmetic-engine/cosmetic-engine';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { StringRuleList } from '../../src/filterlist/rule-list';

const createTestRuleStorage = (listId: number, rules: string[]): RuleStorage => {
    const list = new StringRuleList(listId, rules.join('\n'), false);
    return new RuleStorage([list]);
};

describe('Test cosmetic engine', () => {
    const rules = ['##banner_generic',
        '##banner_generic_disabled',
        'example.org##banner_specific',
        'example.org#@#banner_generic_disabled'];

    it('simple element hiding rules are working', () => {
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, rules));
        const result = cosmeticEngine.match('example.org', true, true, true);
        expect(result).toBeDefined();
    });
});
