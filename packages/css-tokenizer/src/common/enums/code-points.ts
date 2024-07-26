/**
 * @file Character code points used in the tokenizer.
 */

/**
 * "Imaginary" code points, used to represent special cases such as EOF
 */
export const enum ImaginaryCodePoint {
    /**
     * End Of File (end of source code)
     */
    Eof = -1,
}

/**
 * Standard code points
 */
export const enum CodePoint {
    /**
     * U+0000 NULL
     */
    Null = 0x00,

    /**
     * U+0009 CHARACTER TABULATION (TAB)
     */
    CharacterTabulation = 0x09,

    /**
     * U+000B LINE TABULATION
     */
    LineTabulation = 0x0B,

    /**
     * U+0020 SPACE
     */
    Space = 0x20,

    /**
     * U+000A LINE FEED (LF)
     */
    LineFeed = 0x0A,

    /**
     * U+000C FORM FEED (FF)
     */
    FormFeed = 0x0C,

    /**
     * U+000D CARRIAGE RETURN (CR)
     */
    CarriageReturn = 0x0D,

    /**
     * U+0028 LEFT PARENTHESIS: `(`
     */
    LeftParenthesis = 0x28,

    /**
     * U+0029 RIGHT PARENTHESIS: `)`
     */
    RightParenthesis = 0x29,

    /**
     * U+005B LEFT SQUARE BRACKET: `[`
     */
    LeftSquareBracket = 0x5B,

    /**
     * U+005D RIGHT SQUARE BRACKET: `]`
     */
    RightSquareBracket = 0x5D,

    /**
     * U+007B LEFT CURLY BRACKET: `{`
     */
    LeftCurlyBracket = 0x7B,

    /**
     * U+007D RIGHT CURLY BRACKET: `}`
     */
    RightCurlyBracket = 0x7D,

    /**
     * U+0027 APOSTROPHE: `'`
     */
    Apostrophe = 0x27,

    /**
     * U+0022 QUOTATION MARK: `"`
     */
    QuotationMark = 0x22,

    /**
     * U+002A ASTERISK: `*`
     */
    Asterisk = 0x2A,

    /**
     * U+002B PLUS SIGN: `+`
     */
    PlusSign = 0x2B,

    /**
     * U+002C COMMA: `,`
     */
    Comma = 0x2C,

    /**
     * U+002D HYPHEN-MINUS: `-`
     */
    HyphenMinus = 0x2D,

    /**
     * U+002E FULL STOP: `.`
     */
    FullStop = 0x2E,

    /**
     * U+002F SOLIDUS: `/`
     */
    Solidus = 0x2F,

    /**
     * U+003A COLON: `:`
     */
    Colon = 0x3A,

    /**
     * U+003B SEMICOLON: `;`
     */
    SemiColon = 0x3B,

    /**
     * U+003C LESS-THAN SIGN: `<`
     */
    LessThanSign = 0x3C,

    /**
     * U+003E GREATER-THAN SIGN: `>`
     */
    GreaterThanSign = 0x3E,

    /**
     * U+0040 COMMERCIAL AT: `@`
     */
    CommercialAt = 0x40,

    /**
     * U+005C REVERSE SOLIDUS: `\`
     */
    ReverseSolidus = 0x5C,

    /**
     * U+0023 NUMBER SIGN: `#`
     */
    NumberSign = 0x23,

    /**
     * U+0021 EXCLAMATION MARK: `!`
     */
    ExclamationMark = 0x21,

    /**
     * U+005F LOW LINE: `_`
     */
    LowLine = 0x5F,

    /**
     * U+0030 DIGIT ZERO: `0`
     */
    DigitZero = 0x30,

    /**
     * U+0031 DIGIT ONE: `1`
     */
    DigitOne = 0x31,

    /**
     * U+0032 DIGIT TWO: `2`
     */
    DigitTwo = 0x32,

    /**
     * U+0033 DIGIT THREE: `3`
     */
    DigitThree = 0x33,

    /**
     * U+0034 DIGIT FOUR: `4`
     */
    DigitFour = 0x34,

    /**
     * U+0035 DIGIT FIVE: `5`
     */
    DigitFive = 0x35,

    /**
     * U+0036 DIGIT SIX: `6`
     */
    DigitSix = 0x36,

    /**
     * U+0037 DIGIT SEVEN: `7`
     */
    DigitSeven = 0x37,

    /**
     * U+0038 DIGIT EIGHT: `8`
     */
    DigitEight = 0x38,

    /**
     * U+0039 DIGIT NINE: `9`
     */
    DigitNine = 0x39,

    /**
     * U+0041 LATIN CAPITAL LETTER A: `A`
     */
    LatinCapitalLetterA = 0x41,

    /**
     * U+0045 LATIN CAPITAL LETTER E: `E`
     */
    LatinCapitalLetterE = 0x45,

    /**
     * U+0046 LATIN CAPITAL LETTER F: `F`
     */
    LatinCapitalLetterF = 0x46,

    /**
     * U+005A LATIN CAPITAL LETTER Z: `Z`
     */
    LatinCapitalLetterZ = 0x5A,

    /**
     * U+0061 LATIN SMALL LETTER A: `a`
     */
    LatinSmallLetterA = 0x61,

    /**
     * U+0065 LATIN SMALL LETTER E: `e`
     */
    LatinSmallLetterE = 0x65,

    /**
     * U+0066 LATIN SMALL LETTER F: `f`
     */
    LatinSmallLetterF = 0x66,

    /**
     * U+007A LATIN SMALL LETTER Z: `z`
     */
    LatinSmallLetterZ = 0x7A,

    /**
     * U+0025 PERCENT SIGN: `%`
     */
    PercentageSign = 0x25,

    /**
     * U+0008 BACKSPACE
     */
    Backspace = 0x08,

    /**
     * U+000E SHIFT OUT
     */
    ShiftOut = 0x0E,

    /**
     * U+001F INFORMATION SEPARATOR ONE
     */
    InformationSeparatorOne = 0x1F,

    /**
     * U+007F DELETE
     */
    Delete = 0x7F,

    /**
     * U+FFFE UTF-16LE BOM
     */
    Utf16LeBom = 0xFFFE,

    /**
     * U+FEFF UTF-16BE BOM
     */
    Utf16BeBom = 0xFEFF,

    /**
     * U+FFFD REPLACEMENT CHARACTER
     */
    ReplacementCharacter = 0xFFFD,

    /**
     * U+10FFFF Maximum valid code point
     */
    MaxCodePoint = 0x10FFFF,

    /**
     * U+0080 <control> Start of a control character range
     */
    ControlCharacterStart = 0x80,

    /**
     * U+D800 <surrogate> Start of a surrogate pair
     */
    LeadingSurrogateStart = 0xD800,

    /**
     * U+DBFF <surrogate> End of a surrogate pair
     */
    LeadingSurrogateEnd = 0xDBFF,

    /**
     * U+DC00 <surrogate> Start of a surrogate pair
     */
    TrailingSurrogateStart = 0xDC00,

    /**
     * U+DFFF <surrogate> End of a surrogate pair
     */
    TrailingSurrogateEnd = 0xDFFF,
}
