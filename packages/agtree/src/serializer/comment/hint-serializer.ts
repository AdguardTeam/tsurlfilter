import { NULL } from '../../utils/constants';
import { BinaryTypeMap, type Hint } from '../../nodes';
import { ParameterListSerializer } from '../misc/parameter-list-serializer';
import { ValueSerializer } from '../misc/value-serializer';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { BaseSerializer } from '../base-serializer';
import {
    FREQUENT_HINTS_SERIALIZATION_MAP,
    FREQUENT_PLATFORMS_SERIALIZATION_MAP,
    HintNodeMarshallingMap,
} from '../../serialization-utils/comment/hint-common';

/**
 * `HintSerializer` is responsible for serializing AdGuard hints.
 *
 * @example
 * If the hint rule is
 * ```adblock
 * !+ NOT_OPTIMIZED PLATFORM(windows)
 * ```
 * then the hints are `NOT_OPTIMIZED` and `PLATFORM(windows)`, and this
 * class is responsible for parsing them. The rule itself is parsed by
 * the `HintRuleParser`, which uses this class to parse single hints.
 */
export class HintSerializer extends BaseSerializer {
    /**
     * Serializes a hint node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: Hint, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.HintNode);

        buffer.writeUint8(HintNodeMarshallingMap.Name);
        ValueSerializer.serialize(node.name, buffer, FREQUENT_HINTS_SERIALIZATION_MAP);

        if (!isUndefined(node.params)) {
            buffer.writeUint8(HintNodeMarshallingMap.Params);
            ParameterListSerializer.serialize(node.params, buffer, FREQUENT_PLATFORMS_SERIALIZATION_MAP);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(HintNodeMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(HintNodeMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
