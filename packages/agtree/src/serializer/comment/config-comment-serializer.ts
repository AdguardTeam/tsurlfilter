import { NULL } from '../../utils/constants';
import { type ConfigCommentRule, BinaryTypeMap, type ConfigNode } from '../../nodes';
import { ParameterListSerializer } from '../misc/parameter-list-serializer';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { ValueSerializer } from '../misc/value-serializer';
import { isUndefined } from '../../utils/type-guards';
import { BaseSerializer } from '../base-serializer';
import {
    ConfigCommentRuleMarshallingMap,
    ConfigNodeMarshallingMap,
    FREQUENT_COMMANDS_SERIALIZATION_MAP,
} from '../../serialization-utils/comment/config-comment-common';

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

        buffer.writeUint8(ConfigNodeMarshallingMap.Value);
        // note: we don't support serializing generic objects, only AGTree nodes
        // this is a very special case, so we just stringify the configuration object
        buffer.writeString(JSON.stringify(node.value));

        if (!isUndefined(node.start)) {
            buffer.writeUint8(ConfigNodeMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(ConfigNodeMarshallingMap.End);
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

        buffer.writeUint8(ConfigCommentRuleMarshallingMap.Marker);
        ValueSerializer.serialize(node.marker, buffer);

        buffer.writeUint8(ConfigCommentRuleMarshallingMap.Command);
        ValueSerializer.serialize(node.command, buffer, FREQUENT_COMMANDS_SERIALIZATION_MAP, true);

        if (!isUndefined(node.params)) {
            buffer.writeUint8(ConfigCommentRuleMarshallingMap.Params);
            if (node.params.type === 'ParameterList') {
                ParameterListSerializer.serialize(node.params, buffer);
            } else {
                ConfigCommentSerializer.serializeConfigNode(node.params, buffer);
            }
        }

        if (!isUndefined(node.comment)) {
            buffer.writeUint8(ConfigCommentRuleMarshallingMap.Comment);
            ValueSerializer.serialize(node.comment, buffer);
        }

        if (!isUndefined(node.start)) {
            buffer.writeUint8(ConfigCommentRuleMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(ConfigCommentRuleMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
