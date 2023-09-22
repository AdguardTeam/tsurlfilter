import { ModifierParser } from '../../../src/parser/misc/modifier';

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
        return ModifierParser.generate(ast);
    }

    return null;
};

describe('ModifierParser', () => {
    describe('parse', () => {
        it('should throw an error if the modifier is invalid', () => {
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
                    loc: {
                        start: {
                            offset: 0,
                        },
                        end: {
                            offset: 1,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 0,
                            },
                            end: {
                                offset: 1,
                            },
                        },
                        value: 'a',
                    },
                    exception: false,
                },
            );

            expect(ModifierParser.parse('~a')).toMatchObject(
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 0,
                        },
                        end: {
                            offset: 2,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 1,
                            },
                            end: {
                                offset: 2,
                            },
                        },
                        value: 'a',
                    },
                    exception: true,
                },
            );

            expect(ModifierParser.parse('a=b')).toMatchObject(
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 0,
                        },
                        end: {
                            offset: 3,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 0,
                            },
                            end: {
                                offset: 1,
                            },
                        },
                        value: 'a',
                    },
                    value: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 2,
                            },
                            end: {
                                offset: 3,
                            },
                        },
                        value: 'b',
                    },
                    exception: false,
                },
            );

            expect(ModifierParser.parse('a=~b')).toMatchObject(
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 0,
                        },
                        end: {
                            offset: 4,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 0,
                            },
                            end: {
                                offset: 1,
                            },
                        },
                        value: 'a',
                    },
                    value: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 2,
                            },
                            end: {
                                offset: 4,
                            },
                        },
                        value: '~b',
                    },
                    exception: false,
                },
            );

            expect(ModifierParser.parse(' a = b ')).toMatchObject(
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 1,
                        },
                        end: {
                            offset: 6,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 1,
                            },
                            end: {
                                offset: 2,
                            },
                        },
                        value: 'a',
                    },
                    value: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 5,
                            },
                            end: {
                                offset: 6,
                            },
                        },
                        value: 'b',
                    },
                    exception: false,
                },
            );

            expect(ModifierParser.parse('~a=b')).toMatchObject(
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 0,
                        },
                        end: {
                            offset: 4,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 1,
                            },
                            end: {
                                offset: 2,
                            },
                        },
                        value: 'a',
                    },
                    value: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 3,
                            },
                            end: {
                                offset: 4,
                            },
                        },
                        value: 'b',
                    },
                    exception: true,
                },
            );
        });
    });

    describe('generate', () => {
        it('should generate back the modifier', () => {
            expect(generate('a')).toEqual('a');
            expect(generate('~a')).toEqual('~a');
            expect(generate('a=b')).toEqual('a=b');
            expect(generate('a = b')).toEqual('a=b');
            expect(generate('~a=b')).toEqual('~a=b');
            expect(generate('~a = b')).toEqual('~a=b');
            expect(generate(' ~a = b ')).toEqual('~a=b');
        });
    });
});
