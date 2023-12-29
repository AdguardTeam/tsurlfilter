/**
 * @file Common options for all parsers.
 */

import { type Location, defaultLocation } from './common';

/**
 * Common options for all parsers.
 */
export interface ParserOptions {
    /**
     * If `true`, then the parser will not throw an error if the rule is syntactically invalid, instead it will
     * return an `InvalidRule` object with the error attached to it.
     */
    tolerant?: boolean;

    /**
     * Base location for parsing (and positions will be relative for this).
     */
    baseLoc: Location;

    /**
     * Is {@link Location} included in AST.
     */
    isLocIncluded?: boolean;

    /**
     * Parse Adblock Plus-specific rules.
     */
    parseAbpSpecificRules?: boolean;

    /**
     * Parse uBlock Origin-specific rules.
     */
    parseUboSpecificRules?: boolean;
}

/**
 * Default parser options.
 */
export const defaultParserOptions: ParserOptions = {
    tolerant: false,
    baseLoc: defaultLocation,
    isLocIncluded: true,
    parseAbpSpecificRules: true,
    parseUboSpecificRules: true,
};

/**
 * Get parser options or use default values.
 *
 * @param options Options to be used for parsing.
 * @returns Parser options.
 */
export const getParserOptions = (options: Partial<ParserOptions> = {}): ParserOptions => {
    return {
        ...defaultParserOptions,
        ...options,
    };
};
