import { mergeMaps } from '../../src/utils/maps';

describe('Map utils', () => {
    describe('mergeMaps', () => {
        test('should merge two maps', () => {
            const map1 = new Map([['a', 1], ['b', 2]]);
            const map2 = new Map([['c', 3], ['d', 4]]);
            expect(mergeMaps(map1, map2)).toEqual(
                new Map([['a', 1], ['b', 2], ['c', 3], ['d', 4]]),
            );
        });

        test('should use the value from the second map if a key is present in both maps', () => {
            const map1 = new Map([['a', 1], ['b', 2]]);
            const map2 = new Map([['b', 3], ['c', 4]]);
            expect(mergeMaps(map1, map2)).toEqual(
                new Map([['a', 1], ['b', 3], ['c', 4]]),
            );
        });

        test('should not modify the original maps', () => {
            const map1 = new Map([['a', 1], ['b', 2]]);
            const map2 = new Map([['b', 3], ['c', 4]]);
            mergeMaps(map1, map2);
            expect(map1).toEqual(new Map([['a', 1], ['b', 2]]));
            expect(map2).toEqual(new Map([['b', 3], ['c', 4]]));
        });
    });
});
