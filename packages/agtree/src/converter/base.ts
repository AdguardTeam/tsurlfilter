/**
 * @file Base class for rule converters
 */

/* eslint-disable jsdoc/require-returns-check */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { AnyRule } from '../parser/common';

/**
 * Helper function to throw not implemented error
 */
function throwNotImplementedError(): never {
    throw new Error('Not implemented');
}

/**
 * Basic class for rule converters
 */
export class RuleConverter {
    /**
     * Convert rule to AdGuard format
     *
     * @param rule Rule to convert, can be a string or an AST
     * @returns Array of converted rules ASTs
     * @throws If the rule is invalid or incompatible
     */
    public static convertToAdg(rule: string | AnyRule): AnyRule[] {
        throwNotImplementedError();
    }

    /**
     * Convert rule to Adblock Plus format
     *
     * @param rule Rule to convert, can be a string or an AST
     * @returns Array of converted rules ASTs
     * @throws If the rule is invalid or incompatible
     * @todo Currently not implemented in the library and temporary optional
     */
    public static convertToAbp(rule: string | AnyRule): AnyRule[] {
        throwNotImplementedError();
    }

    /**
     * Convert rule to uBlock Origin format
     *
     * @param rule Rule to convert, can be a string or an AST
     * @returns Array of converted rules ASTs
     * @throws If the rule is invalid or incompatible
     * @todo Currently not implemented in the library and temporary optional
     */
    public static convertToUbo(rule: string | AnyRule): AnyRule[] {
        throwNotImplementedError();
    }
}
