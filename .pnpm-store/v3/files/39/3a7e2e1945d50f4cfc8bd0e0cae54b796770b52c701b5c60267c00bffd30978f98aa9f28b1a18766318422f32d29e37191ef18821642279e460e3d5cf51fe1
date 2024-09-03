/**
 * Possible token types.
 *
 * IMPORTANT: it is used as 'const' instead of 'enum' to avoid side effects
 * during ExtendedCss import into other libraries.
 */
export declare const TOKEN_TYPE: {
    readonly MARK: "mark";
    readonly WORD: "word";
};
declare type TokenType = typeof TOKEN_TYPE[keyof typeof TOKEN_TYPE];
export declare type Token = {
    type: TokenType;
    value: string;
};
/**
 * Splits `input` string into tokens.
 *
 * @param input Input string to tokenize.
 * @param supportedMarks Array of supported marks to considered as `TOKEN_TYPE.MARK`;
 * all other will be considered as `TOKEN_TYPE.WORD`.
 *
 * @returns Array of tokens.
 */
export declare const tokenize: (input: string, supportedMarks: string[]) => Token[];
export {};
