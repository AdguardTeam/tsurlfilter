import { describe, expect, it } from 'vitest';

import {
    findHeaderByName,
    hasHeaderByName,
    hasHeader,
    removeHeader,
} from '../../../../src/lib/common/utils/headers';

describe('Headers utils', () => {
    it('finds header by name', () => {
        let result = findHeaderByName([], 'test_name');
        expect(result).toBeNull();

        result = findHeaderByName([
            {
                name: 'an_other_name',
                value: 'an_other_value',
            },
        ], 'test_name');
        expect(result).toBeNull();

        result = findHeaderByName([
            {
                name: 'test_name',
                value: 'test_value',
            },
            {
                name: 'an_other_name',
                value: 'an_other_value',
            },
        ], 'test_name');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('test_name');

        // case-insensitive
        result = findHeaderByName([
            {
                name: 'test_name',
                value: 'test_value',
            },
            {
                name: 'an_other_name',
                value: 'an_other_value',
            },
        ], 'TEST_name');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('test_name');

        result = findHeaderByName([
            {
                name: 'test_NAME',
                value: 'test_value',
            },
            {
                name: 'an_other_name',
                value: 'an_other_value',
            },
        ], 'TEST_name');
        expect(result).not.toBeNull();
        expect(result!.name).toBe('test_NAME');
    });

    it('identifies is header included by name', () => {
        let result = hasHeaderByName([], 'test_name');
        expect(result).toBe(false);

        result = hasHeaderByName([
            {
                name: 'an_other_name',
                value: 'an_other_value',
            },
        ], 'test_name');
        expect(result).toBe(false);

        result = hasHeaderByName([
            {
                name: 'test_name',
                value: 'test_value',
            },
            {
                name: 'an_other_name',
                value: 'an_other_value',
            },
        ], 'test_name');
        expect(result).toBe(true);

        // case-insensitive
        result = hasHeaderByName([
            {
                name: 'test_name',
                value: 'test_value',
            },
            {
                name: 'an_other_name',
                value: 'an_other_value',
            },
        ], 'AN_other_NAME');
        expect(result).toBe(true);
    });

    it('identifies is header included', () => {
        let result = hasHeader([], {
            name: 'test_name',
            value: 'test_value',
        });
        expect(result).toBe(false);

        result = hasHeader([
            {
                name: 'an_other_name',
                value: 'an_other_value',
            },
        ], {
            name: 'test_name',
            value: 'test_value',
        });
        expect(result).toBe(false);

        result = hasHeader([
            {
                name: 'test_name',
                value: 'test_value',
            },
            {
                name: 'an_other_name',
                value: 'an_other_value',
            },
        ], {
            name: 'test_name',
            value: 'an_other_value',
        });
        expect(result).toBe(false);

        result = hasHeader([
            {
                name: 'test_name',
                value: 'test_value',
            },
            {
                name: 'an_other_name',
                value: 'an_other_value',
            },
        ], {
            name: 'test_name',
            value: 'test_value',
        });
        expect(result).toBe(true);

        // case-insensitive (only header name)
        result = hasHeader([
            {
                name: 'test_name',
                value: 'test_value',
            },
            {
                name: 'an_other_name',
                value: 'an_other_value',
            },
        ], {
            name: 'TEST_nAme',
            value: 'test_value',
        });
        expect(result).toBe(true);

        result = hasHeader([
            {
                name: 'test_name',
                value: 'test_value',
            },
            {
                name: 'an_other_name',
                value: 'an_other_value',
            },
        ], {
            name: 'TEST_nAme',
            value: 'Test_Value',
        });
        expect(result).toBe(false);
    });

    it('removes header by name', () => {
        expect(removeHeader([], 'test_name')).toBeFalsy();

        expect(removeHeader([
            {
                name: 'an_other_name',
                value: 'an_other_value',
            },
        ], 'test_name')).toBeFalsy();

        const headers1 = [
            {
                name: 'test_name',
                value: 'test_value',
            },
            {
                name: 'an_other_name',
                value: 'an_other_value',
            },
        ];
        expect(removeHeader(headers1, 'test_name')).toBeTruthy();
        expect(headers1).toHaveLength(1);
        expect(headers1.find((x) => x.name === 'test_name')).not.toBeDefined();

        // case-insensitive
        const headers2 = [
            {
                name: 'test_name',
                value: 'test_value',
            },
            {
                name: 'an_other_name',
                value: 'an_other_value',
            },
        ];
        expect(removeHeader(headers2, 'TEST_NAME')).toBeTruthy();
        expect(headers2).toHaveLength(1);
        expect(headers2.find((x) => x.name === 'test_name')).not.toBeDefined();
    });
});
