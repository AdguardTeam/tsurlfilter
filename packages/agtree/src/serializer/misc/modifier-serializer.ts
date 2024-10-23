import { NULL } from '../../utils/constants';
import { type Modifier } from '../../nodes';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { ValueSerializer } from './value-serializer';
import { isUndefined } from '../../utils/type-guards';
import { BaseSerializer } from '../base-serializer';
import {
    FREQUENT_MODIFIERS_MARSHALLING_MAP,
    FREQUENT_REDIRECT_MODIFIERS_MARSHALLING_MAP,
    ModifierNodeMarshallingMap,
} from '../../serialization-utils/misc/modifier-common';
import { BinaryTypeMarshallingMap } from '../../common/marshalling-common';

/**
 * `ModifierSerializer` is responsible for serializing modifiers.
 *
 * @example
 * `match-case`, `~third-party`, `domain=example.com|~example.org`
 */
export class ModifierSerializer extends BaseSerializer {
    /**
     * Serializes a modifier node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: Modifier, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMarshallingMap.ModifierNode);

        buffer.writeUint8(ModifierNodeMarshallingMap.Name);
        ValueSerializer.serialize(node.name, buffer, FREQUENT_MODIFIERS_MARSHALLING_MAP);

        if (!isUndefined(node.value)) {
            buffer.writeUint8(ModifierNodeMarshallingMap.Value);
            ValueSerializer.serialize(
                node.value,
                buffer,
                FREQUENT_REDIRECT_MODIFIERS_MARSHALLING_MAP.get(node.name.value),
            );
        }

        buffer.writeUint8(ModifierNodeMarshallingMap.Exception);
        buffer.writeUint8(node.exception ? 1 : 0);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(ModifierNodeMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(ModifierNodeMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
