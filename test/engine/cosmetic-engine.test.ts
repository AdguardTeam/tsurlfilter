import { CosmeticEngine } from '../../src/engine/cosmetic-engine/cosmetic-engine';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { StringRuleList } from '../../src/filterlist/rule-list';

const createTestRuleStorage = (listId: number, rules: string[]): RuleStorage => {
    const list = new StringRuleList(listId, rules.join('\n'), false);
    return new RuleStorage([list]);
};

describe('Test cosmetic engine', () => {
    const specificRuleContent = 'banner_specific';
    const specificRule = `example.org##${specificRuleContent}`;

    const genericRuleContent = 'banner_generic';
    const genericRule = `##${genericRuleContent}`;

    const genericDisabledRuleContent = 'banner_generic_disabled';
    const genericDisabledRule = `##${genericDisabledRuleContent}`;
    const specificDisablingRule = `example.org#@#${genericDisabledRuleContent}`;

    const rules = [
        specificRule,
        specificDisablingRule,
        genericRule,
        genericDisabledRule,
    ];

    it('finds simple hiding rules (not extended css rules)', () => {
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            specificRule,
            specificDisablingRule,
            genericRule,
            genericDisabledRule,
        ]));

        const result = cosmeticEngine.match('example.org', true, true, true);
        expect(result).toBeDefined();

        expect(result.elementHiding.generic.length).toEqual(1);
        expect(result.elementHiding.specific.length).toEqual(1);
        expect(result.elementHiding.genericExtCss.length).toBe(0);
        expect(result.elementHiding.specificExtCss.length).toBe(0);
    });

    it('finds specific rule and not whitelisted generic rule', () => {
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, rules));
        const result = cosmeticEngine.match('example.org', true, true, true);
        expect(result).toBeDefined();

        expect(result.elementHiding.generic).toContain(genericRuleContent);
        expect(result.elementHiding.generic).not.toContain(genericDisabledRuleContent);
        expect(result.elementHiding.specific).toContain(specificRuleContent);
    });

    it('finds generic rules for domain without specific rules', () => {
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, rules));
        const result = cosmeticEngine.match('example.com', true, true, true);
        expect(result).toBeDefined();

        expect(result.elementHiding.generic).toContain(genericRuleContent);
        expect(result.elementHiding.generic).toContain(genericDisabledRuleContent);
        expect(result.elementHiding.specific).not.toContain(specificRuleContent);
    });


    it('excludes generic css rules if necessary', () => {
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, rules));
        const result = cosmeticEngine.match('example.org', true, true, false);
        expect(result).toBeDefined();


        expect(result.elementHiding.generic.length).toBe(0);
        expect(result.elementHiding.specific).toContain(specificRuleContent);
    });

    it('excludes all css rules if necessary, even if generic argument is true', () => {
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, rules));
        const result = cosmeticEngine.match('example.org', false, true, true);
        expect(result).toBeDefined();


        expect(result.elementHiding.generic.length).toBe(0);
        expect(result.elementHiding.specific.length).toBe(0);
    });

    // TODO add tests CSS cosmetic script results
    // TODO add tests cosmetic script results
});
