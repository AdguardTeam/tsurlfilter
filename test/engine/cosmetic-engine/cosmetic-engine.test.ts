import { CosmeticEngine } from '../../../src/engine/cosmetic-engine/cosmetic-engine';
import { RuleStorage } from '../../../src/filterlist/rule-storage';
import { StringRuleList } from '../../../src/filterlist/rule-list';

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

    it('correctly detects extended css rules', () => {
        const extCssSpecificRuleText = '.ext_css_specific[-ext-contains=test]';
        const extCssSpecificRule = `example.org##${extCssSpecificRuleText}`;
        const extCssGenericRuleText = '.ext_css_generic[-ext-contains=test]';
        const extCssGenericRule = `##${extCssGenericRuleText}`;
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            specificRule,
            genericRule,
            extCssGenericRule,
            extCssSpecificRule,
        ]));
        const result = cosmeticEngine.match('example.org', true, true, true);
        expect(result.elementHiding.genericExtCss).toContain(extCssGenericRuleText);
        expect(result.elementHiding.specificExtCss).toContain(extCssSpecificRuleText);
    });

    it('correctly detects cosmetic css rules', () => {
        const cssRuleText = '.cosmetic { visibility: hidden; }';
        const specificCssRule = `example.org#$#${cssRuleText}`;
        const genericCssRule = `#$#${cssRuleText}`;
        const extCssCssRuleText = ':has(.ext-css-cosmetic) { visibility: hidden; }';
        const extCssSpecificCssRule = `example.org#$#${extCssCssRuleText}`;
        const extCssGenericCssRule = `#$#${extCssCssRuleText}`;

        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            specificCssRule,
            genericCssRule,
            extCssSpecificCssRule,
            extCssGenericCssRule,
        ]));

        const result = cosmeticEngine.match('example.org', true, true, true);

        expect(result.CSS.specific).toContain(cssRuleText);
        expect(result.CSS.generic).toContain(cssRuleText);
        expect(result.CSS.specificExtCss).toContain(extCssCssRuleText);
        expect(result.CSS.genericExtCss).toContain(extCssCssRuleText);
    });


    it('correctly detects cosmetic JS rules', () => {
        const jsRuleText = 'window.__gaq = undefined;';
        const specificJsRule = `example.org#%#${jsRuleText}`;
        const genericJsRule = `#%#${jsRuleText}`;

        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            specificJsRule,
            genericJsRule,
        ]));

        const result = cosmeticEngine.match('example.org', true, true, true);

        expect(result.JS.specific).toContain(jsRuleText);
        expect(result.JS.generic).toContain(jsRuleText);
    });

    it('checks cosmetic JS exceptions', () => {
        const jsRule = 'testcases.adguard.com,surge.sh#%#window.__testCase2 = true;';
        const jsExceptionRule = 'testcases.adguard.com,surge.sh#@%#window.__testCase2 = true;';
        const cosmeticEngine = new CosmeticEngine(createTestRuleStorage(1, [
            jsRule,
            jsExceptionRule,
        ]));
        const result = cosmeticEngine.match('testcases.adguard.com', true, true, true);
        expect(result.JS.specific.length).toBe(0);
        expect(result.JS.generic.length).toBe(0);
    });
});
