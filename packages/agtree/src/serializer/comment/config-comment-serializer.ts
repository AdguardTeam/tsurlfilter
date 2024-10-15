import { NULL } from '../../utils/constants';
import { type ConfigCommentRule, BinaryTypeMap, type ConfigNode } from '../../nodes';
import { ParameterListSerializer } from '../misc/parameter-list-serializer';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { ValueSerializer } from '../misc/value-serializer';
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
const enum ConfigCommentRuleSerializationMap {
    Marker = 1,
    Command,
    Params,
    Comment,
    Start,
    End,
}

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum ConfigNodeSerializationMap {
    Value = 1,
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
 *
 * @see {@link https://github.com/AdguardTeam/AGLint/blob/master/src/linter/inline-config.ts}
 */
const FREQUENT_COMMANDS_SERIALIZATION_MAP = new Map<string, number>([
    ['aglint', 0],
    ['aglint-disable', 1],
    ['aglint-enable', 2],
    ['aglint-disable-next-line', 3],
    ['aglint-enable-next-line', 4],
]);

/**
 * `ConfigCommentParser` is responsible for parsing inline AGLint configuration rules.
 * Generally, the idea is inspired by ESLint inline configuration comments.
 *
 * @see {@link https://eslint.org/docs/latest/user-guide/configuring/rules#using-configuration-comments}
 */
export class ConfigCommentSerializer extends BaseSerializer {
    /**
     * Serializes a config node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    private static serializeConfigNode(node: ConfigNode, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.ConfigNode);

        buffer.writeUint8(ConfigNodeSerializationMap.Value);
        // note: we don't support serializing generic objects, only AGTree nodes
        // this is a very special case, so we just stringify the configuration object
        buffer.writeString(JSON.stringify(node.value));

        if (!isUndefined(node.start)) {
            buffer.writeUint8(ConfigNodeSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(ConfigNodeSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }

    /**
     * Serializes a metadata comment node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    // TODO: add support for raws, if ever needed
    public static serialize(node: ConfigCommentRule, buffer: OutputByteBuffer): void {
        buffer.writeUint8(BinaryTypeMap.ConfigCommentRuleNode);

        buffer.writeUint8(ConfigCommentRuleSerializationMap.Marker);
        ValueSerializer.serialize(node.marker, buffer);

        buffer.writeUint8(ConfigCommentRuleSerializationMap.Command);
        ValueSerializer.serialize(node.command, buffer, FREQUENT_COMMANDS_SERIALIZATION_MAP, true);

        if (!isUndefined(node.params)) {
            buffer.writeUint8(ConfigCommentRuleSerializationMap.Params);
            if (node.params.type === 'ParameterList') {
                ParameterListSerializer.serialize(node.params, buffer);
            } else {
                ConfigCommentSerializer.serializeConfigNode(node.params, buffer);
            }
        }

        if (!isUndefined(node.comment)) {
            buffer.writeUint8(ConfigCommentRuleSerializationMap.Comment);
            ValueSerializer.serialize(node.comment, buffer);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(ConfigCommentRuleSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(ConfigCommentRuleSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
