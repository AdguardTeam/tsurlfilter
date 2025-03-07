import { type ModifierValue } from '../../nodes';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { ValueSerializer } from './value-serializer';
import { BaseSerializer } from '../base-serializer';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common';
import { DomainListSerializer } from './domain-list-serializer';

/**
 * `ModifierValueSerializer` is responsible for serializing modifier values.
 */
export class ModifierValueSerializer extends BaseSerializer {
    /**
     * Serializes a modifier value node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     * @param frequentValuesMap Optional map of frequent values.
     */
    public static serialize(
        node: ModifierValue,
        buffer: OutputByteBuffer,
        frequentValuesMap?: Map<string, number>,
    ): void {
        buffer.writeUint8(BinaryTypeMarshallingMap.ModifierValueNode);

        switch (node.type) {
            case 'DomainList': {
                DomainListSerializer.serialize(node, buffer);
                break;
            }

            case 'Value': {
                ValueSerializer.serialize(
                    node,
                    buffer,
                    frequentValuesMap,
                );
                break;
            }

            default: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                throw new Error(`Unsupported value type: ${(node as any).type}`);
            }
        }
    }
}
