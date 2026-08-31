import { AdblockSyntax } from '../utils/adblockers';
import {
    SYNTAX_ABP,
    SYNTAX_ADG,
    SYNTAX_ALL,
    SYNTAX_UBO,
    type SyntaxFlags,
} from '../utils/syntax-flags';

/**
 * Possible AdGuard agent markers.
 */
const ADG_NAME_MARKERS = new Set([
    'adguard',
    'adg',
]);

/**
 * Possible uBlock Origin agent markers.
 */
const UBO_NAME_MARKERS = new Set([
    'ublock',
    'ublock origin',
    'ubo',
]);

/**
 * Possible Adblock Plus agent markers.
 */
const ABP_NAME_MARKERS = new Set([
    'adblock',
    'adblock plus',
    'adblockplus',
    'abp',
]);

/**
 * Returns the adblock syntax based on the adblock name parsed from the agent type comment.
 * Needed for modifiers validation of network rules by AGLint.
 *
 * @param name Adblock name.
 *
 * @returns Adblock syntax.
 */
export const getAdblockSyntax = (name: string): SyntaxFlags => {
    // Default to SYNTAX_ALL for unrecognized agent names. This is intentional:
    // an unknown agent name (e.g. a future product) should not restrict syntax
    // compatibility — the rule remains universally applicable until explicitly
    // mapped to a known product.
    let syntax: SyntaxFlags = SYNTAX_ALL;
    const lowerCaseName = name.toLowerCase();
    if (ADG_NAME_MARKERS.has(lowerCaseName)) {
        syntax = SYNTAX_ADG;
    } else if (UBO_NAME_MARKERS.has(lowerCaseName)) {
        syntax = SYNTAX_UBO;
    } else if (ABP_NAME_MARKERS.has(lowerCaseName)) {
        syntax = SYNTAX_ABP;
    }
    return syntax;
};

/**
 * Legacy version of {@link getAdblockSyntax} that returns {@link AdblockSyntax} string enum.
 * Used by the legacy parser only.
 *
 * @param name Adblock name.
 *
 * @returns Adblock syntax string.
 */
export const getAdblockSyntaxLegacy = (name: string): AdblockSyntax => {
    const lowerCaseName = name.toLowerCase();
    if (ADG_NAME_MARKERS.has(lowerCaseName)) {
        return AdblockSyntax.Adg;
    }
    if (UBO_NAME_MARKERS.has(lowerCaseName)) {
        return AdblockSyntax.Ubo;
    }
    if (ABP_NAME_MARKERS.has(lowerCaseName)) {
        return AdblockSyntax.Abp;
    }
    return AdblockSyntax.Common;
};
