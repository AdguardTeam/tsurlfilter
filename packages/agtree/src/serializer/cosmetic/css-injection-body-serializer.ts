import { BinaryTypeMap, type CssInjectionRuleBody } from '../../nodes';
import type { OutputByteBuffer } from '../../utils/output-byte-buffer';
import { ValueSerializer } from '../misc/value-serializer';
import { isUndefined } from '../../utils/type-guards';
import { NULL } from '../../utils/constants';
import { BaseSerializer } from '../base-serializer';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the `BINARY_SCHEMA_VERSION`!
 *
 * @note Only 256 values can be represented this way.
 */
const enum CssInjectionRuleSerializationMap {
    SelectorList = 1,
    DeclarationList,
    MediaQueryList,
    Remove,
    Start,
    End,
}

export class CssInjectionBodySerializer extends BaseSerializer {
    /**
     * Serializes a CSS injection rule body node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: CssInjectionRuleBody, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.CssInjectionRuleBody);

        if (node.mediaQueryList) {
            buffer.writeUint8(CssInjectionRuleSerializationMap.MediaQueryList);
            ValueSerializer.serialize(node.mediaQueryList, buffer);
        }

        buffer.writeUint8(CssInjectionRuleSerializationMap.SelectorList);
        ValueSerializer.serialize(node.selectorList, buffer);

        if (node.declarationList) {
            buffer.writeUint8(CssInjectionRuleSerializationMap.DeclarationList);
            ValueSerializer.serialize(node.declarationList, buffer);
        }

        if (node.remove) {
            buffer.writeUint8(CssInjectionRuleSerializationMap.Remove);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(CssInjectionRuleSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(CssInjectionRuleSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
