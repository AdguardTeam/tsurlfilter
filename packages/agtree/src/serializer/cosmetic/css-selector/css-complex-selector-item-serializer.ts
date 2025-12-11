import {
    CssSelectorMarshallingMap,
    FREQUENT_CSS_COMBINATORS_SERIALIZATION_MAP,
} from '../../../marshalling-utils/cosmetic/css-selector-common';
import { type CssComplexSelectorItem } from '../../../nodes';
import { type OutputByteBuffer } from '../../../utils';
import { NULL } from '../../../utils/constants';
import { isUndefined } from '../../../utils/type-guards';
import { BaseSerializer } from '../../base-serializer';
import { ValueSerializer } from '../../misc/value-serializer';
import { CssCompoundSelectorSerializer } from './css-compound-selector-serializer';

/**
 * Serializer for CSS complex selector item nodes.
 */
export class CssComplexSelectorItemSerializer extends BaseSerializer {
    /**
     * Serializes a CSS complex selector item node into a compact binary format.
     *
     * @param node The CssComplexSelectorItem node to serialize.
     * @param buffer The OutputByteBuffer used for writing the binary data.
     * @param frequentAttributes An optional map of frequently used attribute names,
     * along with their corresponding serialization index.
     * @param frequentPseudoClasses An optional map of frequently used pseudo-class names,
     * along with their corresponding serialization index.
     *
     * @throws Error if unable to serialize.
     */
    public static serialize(
        node: CssComplexSelectorItem,
        buffer: OutputByteBuffer,
        frequentAttributes?: Map<string, number>,
        frequentPseudoClasses?: Map<string, number>,
    ): void {
        // write header
        buffer.writeUint8(CssSelectorMarshallingMap.ComplexSelectorItemHeader);

        // write combinator
        if (!isUndefined(node.combinator)) {
            buffer.writeUint8(CssSelectorMarshallingMap.ComplexSelectorItemCombinator);
            ValueSerializer.serialize(node.combinator, buffer, FREQUENT_CSS_COMBINATORS_SERIALIZATION_MAP);
        }

        // write compound selector
        buffer.writeUint8(CssSelectorMarshallingMap.ComplexSelectorItemSelector);
        CssCompoundSelectorSerializer.serialize(
            node.selector,
            buffer,
            frequentAttributes,
            frequentPseudoClasses,
        );

        // write start position
        if (!isUndefined(node.start)) {
            buffer.writeUint8(CssSelectorMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        // write end position
        if (!isUndefined(node.end)) {
            buffer.writeUint8(CssSelectorMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        // write null terminator
        buffer.writeUint8(NULL);
    }
}
