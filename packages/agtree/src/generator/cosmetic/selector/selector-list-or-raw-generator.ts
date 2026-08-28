/**
 * @file Generator for the `SelectorList | Raw` union type.
 *
 * If the node is a `Raw`, returns its `.value` directly.
 * If it is a parsed `SelectorList`, serializes it via
 * {@link SelectorListGenerator.generate}.
 */

import { NodeType, type Raw, type SelectorList } from '../../../nodes';
import { BaseGenerator } from '../../base-generator';

import { SelectorListGenerator } from './selector-list-generator';

/**
 * Generator for `SelectorList | Raw` nodes.
 *
 * Provides a consistent way to serialize either a parsed CSS selector list
 * or a raw string representation.
 */
export class SelectorListOrRawGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the selector list or raw value.
     *
     * @param node SelectorList or Raw node.
     *
     * @returns String representation.
     *
     * @throws Error if the node type is unexpected.
     */
    public static generate(node: SelectorList | Raw): string {
        if (node.type === NodeType.Raw) {
            return node.value;
        }

        return SelectorListGenerator.generate(node);
    }
}
