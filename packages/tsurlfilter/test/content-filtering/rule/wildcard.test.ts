import { Wildcard } from '../../../src/content-filtering/rule/wildcard';

describe('Wildcard', () => {
    it('checks matches with simple wildcard', () => {
        const wildcard = new Wildcard('*part_one*part_two*');

        expect(wildcard.matches('<div id="ad_text">smth part_one\n \npart_two</div>')).toBe(true);
        expect(wildcard.matches('<div id="ad_text">part_onenpart_two</div>')).toBe(true);
        expect(wildcard.matches('<div id="ad_text">smth PART_ONE\n \nPART_TWO</div>')).toBe(true);
        expect(wildcard.matches('<div id="ad_text">smth part_one\n \npart_two smth</div>')).toBe(true);
        expect(wildcard.matches('<div id="ad_text">smth part_one\n \npart_not_two</div>')).toBe(false);
        expect(wildcard.matches('')).toBe(false);
        expect(wildcard.matches('something')).toBe(false);
    });

    it('check matches with more complicated wildcard', () => {
        const wildcard = new Wildcard('*Test*[123]{123}*');

        expect(wildcard.matches('Testtest [123]{123}')).toBe(true);
        expect(wildcard.matches('TEST [123]{123}')).toBe(true);
        expect(wildcard.matches('NOT [123]{123}')).toBe(false);
    });

    it('check defined wildcard', () => {
        const wildcard = new Wildcard('test');

        expect(wildcard.matches('Test')).toBe(true);
        expect(wildcard.matches('TEST')).toBe(true);
        expect(wildcard.matches('NOT')).toBe(false);
    });
});
