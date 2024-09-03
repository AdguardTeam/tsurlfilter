const enum TokenType {
    SpecialModifier = 'specialModifier',
    String = 'string',
    Raw = 'raw',
    Delimiter = 'delim',
}

type Token<T extends TokenType = TokenType> = {
    type: T;
    value: string;
};

type PreprocessedToken = Token<TokenType.Raw | TokenType.SpecialModifier>;
type ProcessedToken = Token<Exclude<TokenType, TokenType.Raw>>;

/**
 * Modifiers that have some stringified entity as a part of their value,
 * e.g regexp, require custom parsing logic
 */
const enum SpecialModifier {
    Replace = 'replace',
    Removeparam = 'removeparam',
    Hls = 'hls',
}

/**
 * Array of special modifiers allow to check for modifier name more efficient
 * by avoiding Object.values(SpecialModifier) calls in custom type-guard while
 * allowing the usage of 'const enum' for SpecialModifier
 */
const SpecialModifiers = [
    SpecialModifier.Replace,
    SpecialModifier.Removeparam,
    SpecialModifier.Hls,
];

const isSpecialModifierToken = (
    token: Token,
): token is Token<TokenType.SpecialModifier> => token.type === TokenType.SpecialModifier;

const enum ModifierValueType {
    Regexp = 'regexp',
    Plain = 'plain',
}

/**
 * Phase is a part of modifier pattern and
 * affects how parser process certain characters
 */
const enum Phase {
    Regexp = 'regexp',
    Replacement = 'replacement',
    Flags = 'flags',
}

/**
 * Pattern describes modifier structure,
 * e.g replace = "/" regexp "/" replacement "/" flags
 */
type Pattern = readonly Phase[];

/**
 * Characters, that are specific to rule options strings
 */
const enum SpecialCharacter {
    OptionDelimiter = ',',
    OptionEscape = '\\',
    RegexpDelimiter = '/',
    ModifierValueMarker = '=',
}

/**
 * Parser helper that implements custom logic of extracting
 * modifier values for specific patterns
 *
 * @param string options string
 * @param startIndex index of value's first character in an options string
 * @pattern pattern to follow
 *
 * @returns ModifierValueData
 */
type ModifierValueParser = (
    string: string,
    startIndex: number,
    pattern: Pattern,
) => ModifierValueData;

/**
 * Modifier value data, which consists of modifier value and index
 * of value's last character. End index allows parser to fast-forward
 * after value has been extracted.
*/
type ModifierValueData = {
    modifierValue: string,
    modifierEndIndex: number,
};

type ModifierPatterns = {
    [key in SpecialModifier]: Pattern;
};

/**
 * TODO (s.atroschenko) git rid of necessity of adding modifier names for simple regexp values (removaparam, hls):
 * use unified 'simple-regexp' pattern instead
 */
const modifiersPatterns: ModifierPatterns = {
    [SpecialModifier.Replace]: [Phase.Regexp, Phase.Replacement, Phase.Flags],
    [SpecialModifier.Removeparam]: [Phase.Regexp, Phase.Flags],
    [SpecialModifier.Hls]: [Phase.Regexp, Phase.Flags],
} as const;

/**
 * Extracts modifier's plain value
 */
const parsePlainValue: ModifierValueParser = (string, startIndex) => {
    let modifierValue = '';
    let modifierEndIndex = -1;

    const chars: string[] = [];
    for (let i = startIndex; i < string.length; i += 1) {
        const c = string[i];

        const isLastChar = i === (string.length - 1);
        const isUnescapedChar = i > 0 && !(string[i - 1] === SpecialCharacter.OptionEscape);

        if ((c === SpecialCharacter.OptionDelimiter && isUnescapedChar) || isLastChar) {
            if (isLastChar) {
                chars.push(c);
            }
            modifierValue = chars.join('');
            modifierEndIndex = i;
            break;
        } else {
            chars.push(c);
        }
    }

    return {
        modifierValue,
        modifierEndIndex,
    };
};

/**
 * Extract modifier's regexp(-like) value
 *
 * @throws on invalid special modifier value
 */
const parseRegexpValue: ModifierValueParser = (string, startIndex, pattern) => {
    let currentPhase: Phase | void;
    const nextPhase = (() => {
        let i = 0;
        return () => {
            if (i < pattern.length) {
                currentPhase = pattern[i];
                i += 1;
                return;
            }
            // Undefined phase indicates that there were more Regexp delimiters
            // than pattern implies and that makes modifier value invalid
            throw new Error('Invalid pattern for regexp modifier value.');
        };
    })();

    let modifierValue = '';
    let modifierEndIndex = -1;

    const chars: string[] = [];
    for (let i = startIndex; i < string.length; i += 1) {
        const c = string[i];

        const isLastChar = i === (string.length - 1);
        const isUnescapedChar = i > 0 && !(string[i - 1] === SpecialCharacter.OptionEscape);

        if (c === SpecialCharacter.RegexpDelimiter && isUnescapedChar) {
            // Step into the next pattern phase
            nextPhase();
        }

        if ((c === SpecialCharacter.OptionDelimiter && isUnescapedChar) || isLastChar) {
            // Skip unescaped commas that are part of regexp
            if (currentPhase === Phase.Regexp) {
                chars.push(c);
                continue;
            }

            if (isLastChar) {
                chars.push(c);
            }

            // Unescaped delimiter and/or last character indicates
            // the end of the modifier value, if current phase is the last one
            if (currentPhase === pattern[pattern.length - 1]) {
                modifierValue = chars.join('');
                modifierEndIndex = i;
                break;
            } else {
                throw new Error('Unexpected options delimiter or end of options string.');
            }
        } else {
            chars.push(c);
        }
    }

    return {
        modifierValue,
        modifierEndIndex,
    };
};

const modifierValueParsers = {
    [ModifierValueType.Regexp]: parseRegexpValue,
    [ModifierValueType.Plain]: parsePlainValue,
} as const;

/**
 * Processes raw tokens by splitting token values by delimiter
 *
 * @param preprocessedTokens array of preprocessed tokens (of TokenType.SpecialModifier | TokenType.Raw type)
 * @param delimiter - delimiter
 * @param escapeCharacter - escape character
 * @param unescape if true, remove escape characters from string
 * @returns array of processed tokens
 */
const tokenize = (
    preprocessedTokens: PreprocessedToken[],
    delimiter: string,
    escapeCharacter: string,
    unescape: boolean,
): ProcessedToken[] => {
    // Split raw tokens
    const nestedProcessedTokens = preprocessedTokens
        .map((token) => {
            // Modifier tokens are already concrete tokens and are being passed down the pipeline here
            if (isSpecialModifierToken(token)) {
                return token;
            }

            const { value: tokenValue } = token;

            const tokens: ProcessedToken[] = [];
            let chars: string[] = [];

            const makeToken = (type: Exclude<TokenType, TokenType.Raw>) => {
                tokens.push({
                    type,
                    value: chars.join(''),
                });
                chars = [];
            };

            for (let i = 0; i < tokenValue.length; i += 1) {
                const c = tokenValue[i];
                if (c === delimiter) {
                    const isEscaped = i > 0 && tokenValue[i - 1] === escapeCharacter;
                    if (isEscaped) {
                        if (unescape) {
                            chars.splice(chars.length - 1, 1);
                        }
                        chars.push(c);
                    } else {
                    // Don't make token with '' value
                    // when raw token starts with a delimiter
                        if (chars.length !== 0) {
                            makeToken(TokenType.String);
                        }
                        chars.push(c);
                        makeToken(TokenType.Delimiter);
                    }
                } else {
                    chars.push(c);
                    // Last character case
                    if (i === (tokenValue.length - 1)) {
                        makeToken(TokenType.String);
                    }
                }
            }

            return tokens;
        });

    // Flatten the result
    const processedTokens: ProcessedToken[] = [];
    for (let i = 0; i < nestedProcessedTokens.length; i += 1) {
        const currentVal = nestedProcessedTokens[i];
        if (Array.isArray(currentVal)) {
            processedTokens.push(...currentVal);
        } else {
            processedTokens.push(currentVal);
        }
    }
    return processedTokens;
};

/**
 * Converts arrays of tokens into array of their values
 *
 * @param tokens array of arbitrary tokens
 * @returns array of tokens' values
 */
const makeWords = (
    tokens: Token[],
): string[] => {
    const words: string[] = [];
    for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i];
        if (token.type !== TokenType.Delimiter) {
            words.push(token.value);
        }
    }
    return words;
};

/**
 * Parses special modifier value
 *
 * @param modifierName name of modifier to be parsed
 * @param string options string
 * @returns object with Modifier token value and next index to keep iterating from
 */
function parseSpecialModifier(modifierName: SpecialModifier, string: string) {
    let tokenValue = `${modifierName}${SpecialCharacter.ModifierValueMarker}`;

    const modifierValueStartIndex = string.indexOf(tokenValue) + tokenValue.length;

    // Define modifier value type
    const valueType = string[modifierValueStartIndex] === SpecialCharacter.RegexpDelimiter
        ? ModifierValueType.Regexp
        : ModifierValueType.Plain;

    // Pick parser for specific type of modifier value
    const parser = modifierValueParsers[valueType];

    // Get pattern of current modifier
    const pattern = modifiersPatterns[modifierName];

    const {
        modifierValue,
        modifierEndIndex,
    } = parser(string, modifierValueStartIndex, pattern);

    if (modifierEndIndex === -1) {
        throw new Error(`Invalid $${modifierName} modifier value.`);
    }

    tokenValue += modifierValue;
    const nextIndex = modifierEndIndex;

    return {
        tokenValue,
        nextIndex,
    };
}

/**
 * Converts options string into array of Raw and Modifier tokens
 *
 * @param string options string
 * @returns array of preprocessed tokens
 */
function splitBySpecialModifierTokens(string: string): PreprocessedToken[] {
    const tokens: PreprocessedToken[] = [];
    let chars: string[] = [];

    const makeToken = (
        tokenType: TokenType.Raw | TokenType.SpecialModifier,
        tokenValue: string,
    ) => {
        tokens.push({
            type: tokenType,
            value: tokenValue,
        });
        chars = [];
    };

    for (let i = 0; i < string.length; i += 1) {
        const c = string[i];
        const isUnescapedChar = i > 0 && !(string[i - 1] === SpecialCharacter.OptionEscape);
        if (c === SpecialCharacter.ModifierValueMarker && isUnescapedChar) {
            // Parse current chars array to get modifier name
            // Assume that modifier name is everything after last ',' and before current '='
            const charsStr = chars.join('');
            const lastCommaIndex = charsStr.lastIndexOf(SpecialCharacter.OptionDelimiter, i);
            // Assertion is used to avoid type-guard for SpecialModifier, making it faster,
            // and reduce call stack size
            const modifierName = charsStr.substring(lastCommaIndex + 1) as SpecialModifier;

            // Check if this is modifier that requires custom parsing logic
            if (!SpecialModifiers.includes(modifierName)) {
                chars.push(c);
                // Last character case
                if (i === (string.length - 1)) {
                    makeToken(TokenType.Raw, charsStr);
                }
                continue;
            }

            // Remove modifier name from char stack,
            // make token from whats left and empty chars
            makeToken(
                TokenType.Raw,
                charsStr.substring(0, charsStr.lastIndexOf(modifierName)),
            );

            // Extract predefined token value and next iteration index
            // Token value includes both name, separator('=') and value of modifier
            const { tokenValue, nextIndex } = parseSpecialModifier(modifierName, string);

            makeToken(TokenType.SpecialModifier, tokenValue);

            i = nextIndex;
        } else {
            chars.push(c);
            // Last character case
            if (i === (string.length - 1)) {
                makeToken(TokenType.Raw, chars.join(''));
            }
        }
    }

    return tokens;
}

/**
 * Splits options string into array of modifier=value pairs
 *
 * @param string - string to split
 * @param unescape - if true, remove escape characters from string
 * @return array of string parts
 * @throws on invalid special modifier value
 */
export function parseOptionsString(string: string, unescape = true): string[] {
    if (!string) {
        return [];
    }

    if (string.startsWith(SpecialCharacter.OptionDelimiter)) {
        // eslint-disable-next-line no-param-reassign
        string = string.substring(1);
    }

    /**
     * Extract modifier tokens for modifiers that require custom parsing
     * https://github.com/AdguardTeam/tsurlfilter/issues/79
     */
    const preprocessedTokens = splitBySpecialModifierTokens(string);

    /**
     * Split raw tokens by delimiter
     */
    const tokens = tokenize(
        preprocessedTokens,
        SpecialCharacter.OptionDelimiter,
        SpecialCharacter.OptionEscape,
        unescape,
    );

    /**
     * Join tokens into words
     */
    return makeWords(tokens);
}
