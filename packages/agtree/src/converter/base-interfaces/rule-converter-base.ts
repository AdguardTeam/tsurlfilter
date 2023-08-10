/**
 * @file Base class for rule converters
 *
 * TS doesn't support abstract static methods, so we should use
 * a workaround and extend this class instead of implementing it
 */

/* eslint-disable jsdoc/require-returns-check */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { NotImplementedError } from '../../errors/not-implemented-error';
import { type Node } from '../../parser/common';
import { ConverterBase } from './converter-base';

/**
 * Basic class for rule converters
 */
export class RuleConverterBase extends ConverterBase {
    /**
     * Converts an adblock filtering rule to AdGuard format, if possible.
     *
     * @param rule Rule node to convert
     * @returns Array of converted rule nodes
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAdg(rule: Node): Node[] {
        throw new NotImplementedError();
    }

    /**
     * Converts an adblock filtering rule to Adblock Plus format, if possible.
     *
     * @param rule Rule node to convert
     * @returns Array of converted rule nodes
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAbp(rule: Node): Node[] {
        throw new NotImplementedError();
    }

    /**
     * Converts an adblock filtering rule to uBlock Origin format, if possible.
     *
     * @param rule Rule node to convert
     * @returns Array of converted rule nodes
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToUbo(rule: Node): Node[] {
        throw new NotImplementedError();
    }
}
