import { everyRefsAreDifferent } from './refs';

describe('Reference utils', () => {
    test('everyRefsAreDifferent', () => {
        // just objects
        const obj1 = { a: 1 };
        const obj2 = { b: 2 };
        const obj3 = { c: 3 };

        expect(everyRefsAreDifferent(obj1, obj2, obj3)).toBeTruthy();

        expect(everyRefsAreDifferent(obj1, obj1, obj3)).toBeFalsy();
        expect(everyRefsAreDifferent(obj1, obj1, obj1)).toBeFalsy();

        // just arrays
        const arr1 = [1, 2, 3];
        const arr2 = [4, 5, 6];
        const arr3 = [7, 8, 9];

        expect(everyRefsAreDifferent(arr1, arr2, arr3)).toBeTruthy();

        expect(everyRefsAreDifferent(arr1, arr1, arr3)).toBeFalsy();
        expect(everyRefsAreDifferent(arr1, arr1, arr1)).toBeFalsy();

        expect(everyRefsAreDifferent(obj1, arr1)).toBeTruthy();

        // objects that contains arrays
        const obj4 = { a: arr1 };
        const obj5 = { b: arr2 };
        const obj6 = { c: arr3 };
        const obj7 = { d: arr1 }; // same array as obj4

        expect(everyRefsAreDifferent(obj4, obj5, obj6)).toBeTruthy();

        expect(everyRefsAreDifferent(obj4, obj4, obj6)).toBeFalsy();
        expect(everyRefsAreDifferent(obj4, obj4, obj4)).toBeFalsy();

        // objects are different, but they contains the same array, so not all references are different
        // example: rule nodes are cloned, but domain lists aren't
        expect(everyRefsAreDifferent(obj4, obj7)).toBeFalsy();
    });
});
