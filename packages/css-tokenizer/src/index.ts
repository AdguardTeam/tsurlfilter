/**
 * @file CSS Tokenizer entry point
 */

// Common interfaces
export type {
    OnTokenCallback,
    OnErrorCallback,
    TokenizerContextFunction,
} from './common/types/function-prototypes';
export { TokenizerContext } from './common/context';
export { TokenType } from './common/enums/token-types';
export { TOKEN_NAMES, getBaseTokenName, getFormattedTokenName } from './utils/token-names';

// CSS Tokenizer
export { tokenize } from './css-tokenizer';

// Extended CSS Tokenizer
export { tokenizeExtended } from './extended-css-tokenizer';

// Identifier decoder
export { decodeIdent } from './utils/ident-decoder';

// Version of the library
export { version } from './version';
