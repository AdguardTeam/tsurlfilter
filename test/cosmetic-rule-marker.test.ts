import { CosmeticRuleMarker, findCosmeticRuleMarker, isCosmetic } from '../src/cosmetic-rule-marker';

describe('findCosmeticRuleMarker', () => {
    it('works if it finds element hiding marker properly', () => {
        let marker: [number, CosmeticRuleMarker | null];

        marker = findCosmeticRuleMarker('example.org##.banner');
        expect(marker[0]).toEqual(11);
        expect(marker[1]).toEqual(CosmeticRuleMarker.ElementHiding);

        marker = findCosmeticRuleMarker('#$#banner { height: 0px; }');
        expect(marker[0]).toEqual(0);
        expect(marker[1]).toEqual(CosmeticRuleMarker.Css);
    });

    it('works if it handles complicated cases', () => {
        let marker: [number, CosmeticRuleMarker | null];

        marker = findCosmeticRuleMarker('example.org#@###banner');
        expect(marker[0]).toEqual(11);
        expect(marker[1]).toEqual(CosmeticRuleMarker.ElementHidingException);

        marker = findCosmeticRuleMarker('example.org#?##banner');
        expect(marker[0]).toEqual(11);
        expect(marker[1]).toEqual(CosmeticRuleMarker.ElementHidingExtCSS);
    });

    it('works if it does not have false positives', () => {
        let marker: [number, CosmeticRuleMarker | null];

        marker = findCosmeticRuleMarker('||example.org/?#');
        expect(marker[0]).toEqual(-1);
        expect(marker[1]).toEqual(null);

        marker = findCosmeticRuleMarker('127.0.0.1 localhost ## this is just a comment');
        expect(marker[0]).toEqual(-1);
        expect(marker[1]).toEqual(null);
    });
});

describe('isCosmetic', () => {
    it('works if it detects cosmetic rules', () => {
        expect(isCosmetic('$$script')).toEqual(true);
        expect(isCosmetic('#%#//scriptlet("test")')).toEqual(true);
        expect(isCosmetic('example.org##banenr')).toEqual(true);

        expect(isCosmetic('||example.org^')).toEqual(false);
        expect(isCosmetic('$domain=example.org')).toEqual(false);
    });
});
