import {
    describe,
    test,
    expect,
    it,
} from 'vitest';

import { type Modifier } from '../../../src/nodes/index.js';
import { ModifierParser } from '../../../src/parser/misc/modifier-parser.js';
import { ModifierGenerator } from '../../../src/generator/misc/modifier-generator.js';
import { ModifierSerializer } from '../../../src/serializer/misc/modifier-serializer.js';
import { ModifierDeserializer } from '../../../src/deserializer/misc/modifier-deserializer.js';

/**
 * Helper function that parses and generates a modifier.
 *
 * @param raw Raw input
 * @returns Generated output or null if the input is doesn't match
 * the parser pattern
 */
const generate = (raw: string) => {
    const ast = ModifierParser.parse(raw);

    if (ast) {
        return ModifierGenerator.generate(ast);
    }

    return null;
};

describe('ModifierParser', () => {
    describe('parse', () => {
        it('should throw an error if the modifier is invalid', () => {
            // TODO: Refactor to test.each
            expect(() => ModifierParser.parse('')).toThrowError(
                'Modifier name cannot be empty',
            );

            expect(() => ModifierParser.parse(' ')).toThrowError(
                'Modifier name cannot be empty',
            );

            expect(() => ModifierParser.parse('a=')).toThrowError(
                'Modifier value cannot be empty',
            );

            expect(() => ModifierParser.parse(' a=')).toThrowError(
                'Modifier value cannot be empty',
            );

            expect(() => ModifierParser.parse(' a= ')).toThrowError(
                'Modifier value cannot be empty',
            );

            expect(() => ModifierParser.parse(' a = ')).toThrowError(
                'Modifier value cannot be empty',
            );
        });

        it('should work correctly if the modifier is valid', () => {
            // Valid modifiers
            expect(ModifierParser.parse('a')).toMatchObject(
                {
                    type: 'Modifier',
                    start: 0,
                    end: 1,
                    name: {
                        type: 'Value',
                        start: 0,
                        end: 1,
                        value: 'a',
                    },
                    exception: false,
                },
            );

            expect(ModifierParser.parse('~a')).toMatchObject(
                {
                    type: 'Modifier',
                    start: 0,
                    end: 2,
                    name: {
                        type: 'Value',
                        start: 1,
                        end: 2,
                        value: 'a',
                    },
                    exception: true,
                },
            );

            expect(ModifierParser.parse('a=b')).toMatchObject(
                {
                    type: 'Modifier',
                    start: 0,
                    end: 3,
                    name: {
                        type: 'Value',
                        start: 0,
                        end: 1,
                        value: 'a',
                    },
                    value: {
                        type: 'Value',
                        start: 2,
                        end: 3,
                        value: 'b',
                    },
                    exception: false,
                },
            );

            expect(ModifierParser.parse('a=~b')).toMatchObject(
                {
                    type: 'Modifier',
                    start: 0,
                    end: 4,
                    name: {
                        type: 'Value',
                        start: 0,
                        end: 1,
                        value: 'a',
                    },
                    value: {
                        type: 'Value',
                        start: 2,
                        end: 4,
                        value: '~b',
                    },
                    exception: false,
                },
            );

            expect(ModifierParser.parse(' a = b ')).toMatchObject(
                {
                    type: 'Modifier',
                    start: 1,
                    end: 6,
                    name: {
                        type: 'Value',
                        start: 1,
                        end: 2,
                        value: 'a',
                    },
                    value: {
                        type: 'Value',
                        start: 5,
                        end: 6,
                        value: 'b',
                    },
                    exception: false,
                },
            );

            expect(ModifierParser.parse('~a=b')).toMatchObject(
                {
                    type: 'Modifier',
                    start: 0,
                    end: 4,
                    name: {
                        type: 'Value',
                        start: 1,
                        end: 2,
                        value: 'a',
                    },
                    value: {
                        type: 'Value',
                        start: 3,
                        end: 4,
                        value: 'b',
                    },
                    exception: true,
                },
            );
        });
    });

    describe('parser options should work as expected', () => {
        test.each<{ actual: string; expected: Modifier }>([
            {
                actual: '~a=b',
                expected: {
                    type: 'Modifier',
                    name: {
                        type: 'Value',
                        value: 'a',
                    },
                    value: {
                        type: 'Value',
                        value: 'b',
                    },
                    exception: true,
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(ModifierParser.parse(actual, { isLocIncluded: false })).toEqual(expected);
        });
    });

    describe('generate', () => {
        it('should generate back the modifier', () => {
            // TODO: Refactor to test.each
            expect(generate('a')).toEqual('a');
            expect(generate('~a')).toEqual('~a');
            expect(generate('a=b')).toEqual('a=b');
            expect(generate('a = b')).toEqual('a=b');
            expect(generate('~a=b')).toEqual('~a=b');
            expect(generate('~a = b')).toEqual('~a=b');
            expect(generate(' ~a = b ')).toEqual('~a=b');
        });
    });

    describe('serialize & deserialize', () => {
        test.each([
            'foo',
            '~foo',
            'foo=bar',
            '~foo=bar',
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(
                ModifierParser,
                ModifierGenerator,
                ModifierSerializer,
                ModifierDeserializer,
            );
        });
    });
});
