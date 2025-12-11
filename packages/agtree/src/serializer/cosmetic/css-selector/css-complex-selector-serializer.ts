import { CssSelectorMarshallingMap } from '../../../marshalling-utils/cosmetic/css-selector-common';
import { type CssComplexSelector } from '../../../nodes';
import { type OutputByteBuffer } from '../../../utils';
import { NULL, UINT8_MAX } from '../../../utils/constants';
import { isUndefined } from '../../../utils/type-guards';
import { BaseSerializer } from '../../base-serializer';
import { CssComplexSelectorItemSerializer } from './css-complex-selector-item-serializer';

/**
 * Serializer for CSS complex selector nodes.
 */
export class CssComplexSelectorSerializer extends BaseSerializer {
    /**
     * Serializes a CSS complex selector node into a compact binary format.
     *
     * @param node The CssComplexSelector node to serialize.
     * @param buffer The OutputByteBuffer used for writing the binary data.
     * @param frequentAttributes An optional map of frequently used attribute names,
     * along with their corresponding serialization index.
     * @param frequentPseudoClasses An optional map of frequently used pseudo-class names,
     * along with their corresponding serialization index.
     *
     * @throws Error if unable to serialize.
     */
    public static serialize(
        node: CssComplexSelector,
        buffer: OutputByteBuffer,
        frequentAttributes?: Map<string, number>,
        frequentPseudoClasses?: Map<string, number>,
    ): void {
        // write header
        buffer.writeUint8(CssSelectorMarshallingMap.ComplexSelectorHeader);

        // write children length
        // note: we store the count, because re-construction of the array is faster if we know the length
        buffer.writeUint8(CssSelectorMarshallingMap.ComplexSelectorChildren);
        const { length } = node.children;
        if (length > UINT8_MAX) {
            throw new Error(`Too many complex selector items: ${length}, the limit is ${UINT8_MAX}`);
        }
        buffer.writeUint8(length);

        // write complex selector items
        for (const complexSelectorItem of node.children) {
            CssComplexSelectorItemSerializer.serialize(
                complexSelectorItem,
                buffer,
                frequentAttributes,
                frequentPseudoClasses,
            );
        }

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
