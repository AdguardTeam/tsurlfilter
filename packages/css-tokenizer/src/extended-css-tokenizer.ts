/**
 * @file Extended CSS tokenizer that extends the core CSS tokenizer
 *
 * This library supports various Extended CSS language elements from
 * - AdGuard,
 * - uBlock Origin and
 * - Adblock Plus.
 *
 * @see {@link https://github.com/AdguardTeam/ExtendedCss}
 * @see {@link https://github.com/gorhill/uBlock/wiki/Procedural-cosmetic-filters}
 * @see {@link https://help.adblockplus.org/hc/en-us/articles/360062733293#elemhide-emulation}
 */

import { handleRegularExtendedCssPseudo } from './algorithms/extended-css-consumers/extended-css-generic';
import { handleXpathExtendedCssPseudo } from './algorithms/extended-css-consumers/extended-css-xpath';
import {
    type OnErrorCallback,
    type OnTokenCallback,
    type TokenizerContextFunction,
    type TokenizerFunction,
} from './common/types/function-prototypes';
import { tokenize } from './css-tokenizer';
import { mergeMaps } from './utils/maps';

const ABP_CONTAINS_HASH = 1989084725; // getStringHash('-abp-contains')
const CONTAINS_HASH = 2399470598; // getStringHash('contains')
const HAS_TEXT_HASH = 1221663855; // getStringHash('has-text')
const MATCHES_CSS_HASH = 102304302; // getStringHash('matches-css')
const MATCHES_CSS_AFTER_HASH = 2923888231; // getStringHash('matches-css-after')
const MATCHES_CSS_BEFORE_HASH = 1739713050; // getStringHash('matches-css-before')
const MATCHES_PROPERTY_HASH = 1860790666; // getStringHash('matches-property')
const MATCHES_ATTR_HASH = 3376104318; // getStringHash('matches-attr')
const XPATH_HASH = 196571984; // getStringHash('xpath')

/**
 * Map of Extended CSS's pseudo-classes and their respective handler functions
 */
const EXT_CSS_PSEUDO_HANDLERS = new Map<number, TokenizerContextFunction>([
    // Note: alternatively, you can use `getStringHash` to get the hash of the pseudo-class name, but we use
    // pre-calculated hashes here for performance reasons
    [ABP_CONTAINS_HASH, handleRegularExtendedCssPseudo],
    [CONTAINS_HASH, handleRegularExtendedCssPseudo],
    [HAS_TEXT_HASH, handleRegularExtendedCssPseudo],
    [MATCHES_CSS_HASH, handleRegularExtendedCssPseudo],
    [MATCHES_CSS_AFTER_HASH, handleRegularExtendedCssPseudo],
    [MATCHES_CSS_BEFORE_HASH, handleRegularExtendedCssPseudo],
    [MATCHES_PROPERTY_HASH, handleRegularExtendedCssPseudo],
    [MATCHES_ATTR_HASH, handleRegularExtendedCssPseudo],
    [XPATH_HASH, handleXpathExtendedCssPseudo],
]);

/**
 * Extended CSS tokenizer function
 *
 * @param source Source code to tokenize
 * @param onToken Tokenizer callback which is called for each token found in source code
 * @param onError Error callback which is called when a parsing error is found (optional)
 * @param functionHandlers Custom function handlers (optional)
 *
 * @note If you specify custom function handlers, they will be merged with the default function handlers. If you
 * duplicate a function handler, the custom one will be used instead of the default one, so you can override the default
 * function handlers this way, if you want to.
 */
export const tokenizeExtended: TokenizerFunction = (
    source: string,
    onToken: OnTokenCallback,
    onError: OnErrorCallback = () => {},
    functionHandlers: Map<number, TokenizerContextFunction> = new Map(),
): void => {
    tokenize(
        source,
        onToken,
        onError,
        // Register custom function handlers for Extended CSS's pseudo-classes, but do not call mergeMaps if there are
        // no custom function handlers are provided
        functionHandlers.size > 0
            ? mergeMaps(EXT_CSS_PSEUDO_HANDLERS, functionHandlers)
            : EXT_CSS_PSEUDO_HANDLERS,
    );
};
