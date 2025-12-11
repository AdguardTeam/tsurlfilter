import { CssSelectorMarshallingMap } from '../../../marshalling-utils/cosmetic/css-selector-common';
import { type CssAttributeSelector } from '../../../nodes';
import { type OutputByteBuffer } from '../../../utils';
import { NULL } from '../../../utils/constants';
import { isUndefined } from '../../../utils/type-guards';
import { BaseSerializer } from '../../base-serializer';
import { ValueSerializer } from '../../misc/value-serializer';
import { CssAttributeSelectorValueSerializer } from './css-attribute-selector-value-serializer';

/**
 * Serializer for CSS attribute selector nodes.
 */
export class CssAttributeSelectorSerializer extends BaseSerializer {
    /**
     * Serializes a CSS attribute selector node into a compact binary format.
     *
     * @param node The CssAttributeSelector node to serialize.
     * @param buffer The OutputByteBuffer used for writing the binary data.
     * @param frequentAttributes An optional map of frequently used attribute names,
     * along with their corresponding serialization index.
     */
    public static serialize(
        node: CssAttributeSelector,
        buffer: OutputByteBuffer,
        frequentAttributes?: Map<string, number>,
    ): void {
        // write header
        buffer.writeUint8(CssSelectorMarshallingMap.AttributeSelectorHeader);

        // write name
        buffer.writeUint8(CssSelectorMarshallingMap.AttributeSelectorName);
        ValueSerializer.serialize(node.name, buffer, frequentAttributes);

        // write value
        if (!isUndefined(node.value)) {
            buffer.writeUint8(CssSelectorMarshallingMap.AttributeSelectorValue);
            CssAttributeSelectorValueSerializer.serialize(node.value, buffer);
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
