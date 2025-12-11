import { CssSelectorMarshallingMap } from '../../../marshalling-utils/cosmetic/css-selector-common';
import { type CssPseudoClassSelector } from '../../../nodes';
import { type OutputByteBuffer } from '../../../utils';
import { NULL } from '../../../utils/constants';
import { isUndefined } from '../../../utils/type-guards';
import { BaseSerializer } from '../../base-serializer';
import { ValueSerializer } from '../../misc/value-serializer';

/**
 * Serializer for CSS pseudo-class selector nodes.
 */
export class CssPseudoClassSelectorSerializer extends BaseSerializer {
    /**
     * Serializes a CSS pseudo-class selector node into a compact binary format.
     *
     * @param node The CssPseudoClassSelector node to serialize.
     * @param buffer The OutputByteBuffer used for writing the binary data.
     * @param frequentPseudoClasses An optional map of frequently used pseudo-class names,
     * along with their corresponding serialization index.
     */
    public static serialize(
        node: CssPseudoClassSelector,
        buffer: OutputByteBuffer,
        frequentPseudoClasses?: Map<string, number>,
    ): void {
        // write header
        buffer.writeUint8(CssSelectorMarshallingMap.PseudoClassSelectorHeader);

        // write name
        buffer.writeUint8(CssSelectorMarshallingMap.PseudoClassSelectorName);
        ValueSerializer.serialize(node.name, buffer, frequentPseudoClasses);

        // write argument
        if (!isUndefined(node.argument)) {
            buffer.writeUint8(CssSelectorMarshallingMap.PseudoClassSelectorArgument);
            ValueSerializer.serialize(node.argument, buffer);
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
