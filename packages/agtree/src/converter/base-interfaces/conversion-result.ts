/**
 * @file Conversion result interface and helper functions
 */

import { type Node } from '../../nodes';

/**
 * Common conversion result interface
 *
 * @template T Type of the item to convert
 * @template U Type of the conversion result (defaults to `T`, but can be `T[]` as well)
 */
export interface ConversionResult<T, U extends T | T[] = T> {
    /**
     * Conversion result
     */
    result: U;

    /**
     * Indicates whether the input item was converted
     */
    isConverted: boolean;
}

/**
 * Adblock rule node conversion result interface, where the conversion result is an array of rules
 */
export type NodeConversionResult<T extends Node> = ConversionResult<T, T[]>;

/**
 * Helper function to create a generic conversion result.
 *
 * @param result Conversion result
 * @param isConverted Indicates whether the input item was converted
 * @template T Type of the item to convert
 * @template U Type of the conversion result (defaults to `T`, but can be `T[]` as well)
 * @returns Generic conversion result
 */
// eslint-disable-next-line max-len
export function createConversionResult<T, U extends T | T[] = T>(result: U, isConverted: boolean): ConversionResult<T, U> {
    return {
        result,
        isConverted,
    };
}

/**
 * Helper function to create a node conversion result.
 *
 * @param nodes Array of nodes
 * @param isConverted Indicates whether the input item was converted
 * @template T Type of the node (extends `Node`)
 * @returns Node conversion result
 */
export function createNodeConversionResult<T extends Node>(nodes: T[], isConverted: boolean): NodeConversionResult<T> {
    return createConversionResult(nodes, isConverted);
}
