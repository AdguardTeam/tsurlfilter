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
import { type NodeConversionResult } from './conversion-result';
import { ConverterBase } from './converter-base';

/**
 * Basic class for rule converters
 */
export class RuleConverterBase extends ConverterBase {
    /**
     * Converts an adblock filtering rule to AdGuard format, if possible.
     *
     * @param rule Rule node to convert
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAdg(rule: Node): NodeConversionResult<Node> {
        throw new NotImplementedError();
    }

    /**
     * Converts an adblock filtering rule to Adblock Plus format, if possible.
     *
     * @param rule Rule node to convert
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToAbp(rule: Node): NodeConversionResult<Node> {
        throw new NotImplementedError();
    }

    /**
     * Converts an adblock filtering rule to uBlock Origin format, if possible.
     *
     * @param rule Rule node to convert
     * @returns An object which follows the {@link NodeConversionResult} interface. Its `result` property contains
     * the array of converted rule nodes, and its `isConverted` flag indicates whether the original rule was converted.
     * If the rule was not converted, the result array will contain the original node with the same object reference
     * @throws If the rule is invalid or cannot be converted
     */
    public static convertToUbo(rule: Node): NodeConversionResult<Node> {
        throw new NotImplementedError();
    }
}
