import { describe, it, expect } from 'vitest';
import zod from 'zod';

import { baseFileSchema, baseCompatibilityDataSchema, COMMON_KEY } from '../../src/compatibility-tables/schemas/base';
import { zodToCamelCase } from '../../src/compatibility-tables/utils/zod-camelcase';

describe('Common Key Feature', () => {
    it('should merge common data with platform-specific data', () => {
        const testSchema = zodToCamelCase(baseCompatibilityDataSchema.extend({
            testField: zod.string().optional(),
        }));

        const schema = baseFileSchema(testSchema);

        const input = {
            common: {
                name: 'test-modifier',
                description: 'Common description',
                deprecated: false,
                testField: 'common-value',
            },
            adg_any: {
                docs: 'https://adguard.com/docs',
            },
            ubo_ext_any: {
                docs: 'https://ubo.com/docs',
                description: 'UBO-specific description',
            },
        };

        const result = schema.parse(input);

        expect(result).toBeDefined();
        const values = Object.values(result);
        expect(values).toHaveLength(2);

        const [adgValue, uboValue] = values;

        expect(adgValue).toMatchObject({
            name: 'test-modifier',
            description: 'Common description',
            deprecated: false,
            testField: 'common-value',
            docs: 'https://adguard.com/docs',
        });

        expect(uboValue).toMatchObject({
            name: 'test-modifier',
            description: 'UBO-specific description',
            deprecated: false,
            testField: 'common-value',
            docs: 'https://ubo.com/docs',
        });
    });

    it('should work without common key (backward compatibility)', () => {
        const testSchema = zodToCamelCase(baseCompatibilityDataSchema);
        const schema = baseFileSchema(testSchema);

        const input = {
            adg_any: {
                name: 'test-modifier',
                description: 'AdGuard description',
            },
            ubo_ext_any: {
                name: 'test-modifier',
                description: 'UBO description',
            },
        };

        const result = schema.parse(input);

        expect(result).toBeDefined();
        expect(Object.keys(result)).toHaveLength(2);
    });

    it('should handle common key alone (all platforms get the same data)', () => {
        const testSchema = zodToCamelCase(baseCompatibilityDataSchema);
        const schema = baseFileSchema(testSchema);

        const input = {
            common: {
                name: 'test-modifier',
                description: 'Common description',
            },
            adg_any: {},
            ubo_ext_any: {},
        };

        const result = schema.parse(input);

        expect(result).toBeDefined();
        const values = Object.values(result);
        const [adgValue, uboValue] = values;

        expect(adgValue).toMatchObject({
            name: 'test-modifier',
            description: 'Common description',
        });

        expect(uboValue).toMatchObject({
            name: 'test-modifier',
            description: 'Common description',
        });
    });

    it('should not include common key in the result', () => {
        const testSchema = zodToCamelCase(baseCompatibilityDataSchema);
        const schema = baseFileSchema(testSchema);

        const input = {
            common: {
                name: 'test-modifier',
            },
            adg_any: {},
        };

        const result = schema.parse(input);

        expect(result).toBeDefined();
        expect(COMMON_KEY in result).toBe(false);
    });
});
