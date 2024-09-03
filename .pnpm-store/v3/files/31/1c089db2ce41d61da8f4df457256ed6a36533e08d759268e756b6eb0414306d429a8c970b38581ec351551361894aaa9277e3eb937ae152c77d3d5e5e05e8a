export type Token = [
    type: (typeof types)[keyof typeof types],
    start: number,
    end: number
];
export declare const types: {
    readonly COMMENT: 1;
    readonly IDENT: 2;
    readonly FUNCTION: 3;
    readonly AT_KEYWORD: 4;
    readonly HASH: 5;
    readonly STRING: 6;
    readonly BAD_STRING: 7;
    readonly URL: 8;
    readonly BAD_URL: 9;
    readonly DELIM: 10;
    readonly NUMBER: 11;
    readonly PERCENTAGE: 12;
    readonly DIMENSION: 13;
    readonly WHITESPACE: 14;
    readonly CDO: 15;
    readonly CDC: 16;
    readonly COLON: 17;
    readonly SEMICOLON: 18;
    readonly COMMA: 19;
    readonly LEFT_SQUARE: 20;
    readonly RIGHT_SQUARE: 21;
    readonly LEFT_PAREN: 22;
    readonly RIGHT_PAREN: 23;
    readonly LEFT_CURLY: 24;
    readonly RIGHT_CURLY: 25;
};
export declare function lex(str: string): Generator<Token>;
export declare const value: (str: string, [token, start, end]: Token) => string | {
    value: number;
    type: 'integer' | 'number';
    signCharacter?: string | undefined;
    unit?: string | undefined;
} | {
    type: string;
    value: string;
} | null;
