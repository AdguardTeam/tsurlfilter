import { BaseSerializer } from '../base-serializer';
import { type ElementHidingRuleBody } from '../../nodes';
import type { OutputByteBuffer } from '../../utils/output-byte-buffer';
import { ValueSerializer } from '../misc/value-serializer';
import { isUndefined } from '../../utils/type-guards';
import { NULL } from '../../utils/constants';
import { ElementHidingRuleMarshallingMap } from '../../serialization-utils/cosmetic/body/element-hiding-body-common';
import { BinaryTypeMarshallingMap } from '../../common/marshalling-common';

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
