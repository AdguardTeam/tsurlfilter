import { NULL } from '../../utils/constants';
import { BinaryTypeMap, type Hint } from '../../nodes';
import { ParameterListSerializer } from '../misc/parameter-list-serializer';
import { ValueSerializer } from '../misc/value-serializer';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { isUndefined } from '../../utils/type-guards';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';
import { BaseSerializer } from '../base-serializer';

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum HintNodeSerializationMap {
    Name = 1,
    Params,
    Start,
    End,
}

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const FREQUENT_HINTS_SERIALIZATION_MAP = new Map<string, number>([
    ['NOT_OPTIMIZED', 0],
    ['PLATFORM', 1],
    ['NOT_PLATFORM', 2],
]);

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const FREQUENT_PLATFORMS_SERIALIZATION_MAP = new Map<string, number>([
    ['windows', 0],
    ['mac', 1],
    ['android', 2],
    ['ios', 3],
    ['ext_chromium', 4],
    ['ext_ff', 5],
    ['ext_edge', 6],
    ['ext_opera', 7],
    ['ext_safari', 8],
    ['ext_android_cb', 9],
    ['ext_ublock', 10],
]);

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

        buffer.writeUint8(HintNodeSerializationMap.Name);
        ValueSerializer.serialize(node.name, buffer, FREQUENT_HINTS_SERIALIZATION_MAP);

        if (!isUndefined(node.params)) {
            buffer.writeUint8(HintNodeSerializationMap.Params);
            ParameterListSerializer.serialize(node.params, buffer, FREQUENT_PLATFORMS_SERIALIZATION_MAP);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(HintNodeSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(HintNodeSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
