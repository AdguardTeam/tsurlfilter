/**
 * @file Base class for rule converters
 *
 * TS doesn't support abstract static methods, so we should use
 * a workaround and extend this class instead of implementing it
 */

/* eslint-disable jsdoc/require-returns-check */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { NotImplementedError } from '../../errors/not-implemented-error';
import { Node } from '../../parser/common';
import { ConverterBase } from './converter-base';

/**
 * Basic class for rule converters
 */
export class RuleConverterBase extends ConverterBase {
    /**
     * Convert rule to AdGuard format
     *
     * @param rule Rule to convert, can be a string or an AST
     * @returns Array of converted rules ASTs
     * @throws If the rule is invalid or incompatible
     */
    public static convertToAdg(rule: Node): Node[] {
        throw new NotImplementedError();
    }

    /**
     * Convert rule to Adblock Plus format
     *
     * @param rule Rule to convert, can be a string or an AST
     * @returns Array of converted rules ASTs
     * @throws If the rule is invalid or incompatible
     * @todo Currently not implemented in the library and temporary optional
     */
    public static convertToAbp(rule: Node): Node[] {
        throw new NotImplementedError();
    }

    /**
     * Convert rule to uBlock Origin format
     *
     * @param rule Rule to convert, can be a string or an AST
     * @returns Array of converted rules ASTs
     * @throws If the rule is invalid or incompatible
     * @todo Currently not implemented in the library and temporary optional
     */
    public static convertToUbo(rule: Node): Node[] {
        throw new NotImplementedError();
    }
}
