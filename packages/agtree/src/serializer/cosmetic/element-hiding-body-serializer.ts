import { BaseSerializer } from '../base-serializer.js';
import { type ElementHidingRuleBody } from '../../nodes/index.js';
import type { OutputByteBuffer } from '../../utils/output-byte-buffer.js';
import { ValueSerializer } from '../misc/value-serializer.js';
import { isUndefined } from '../../utils/type-guards.js';
import { NULL } from '../../utils/constants.js';
import { ElementHidingRuleMarshallingMap } from '../../marshalling-utils/cosmetic/body/element-hiding-body-common.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';

/**
 * Serializer for element hiding rule body nodes.
 */
export class ElementHidingBodySerializer extends BaseSerializer {
    /**
     * Serializes an element hiding rule body node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: ElementHidingRuleBody, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMarshallingMap.ElementHidingRuleBody);

        buffer.writeUint8(ElementHidingRuleMarshallingMap.SelectorList);
        ValueSerializer.serialize(node.selectorList, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(ElementHidingRuleMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(ElementHidingRuleMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
