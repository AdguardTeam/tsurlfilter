import { NULL } from '../../utils/constants.js';
import { type ConfigCommentRule, type ConfigNode } from '../../nodes/index.js';
import { ParameterListSerializer } from '../misc/parameter-list-serializer.js';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer.js';
import { ValueSerializer } from '../misc/value-serializer.js';
import { isUndefined } from '../../utils/type-guards.js';
import { BaseSerializer } from '../base-serializer.js';
import {
    ConfigCommentRuleMarshallingMap,
    ConfigNodeMarshallingMap,
    FREQUENT_COMMANDS_SERIALIZATION_MAP,
} from '../../marshalling-utils/comment/config-comment-common.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';

/**
 * `ConfigCommentSerializer` is responsible for serializing inline AGLint configuration rules into a binary format.
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
        buffer.writeUint8(BinaryTypeMarshallingMap.ConfigNode);

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
        buffer.writeUint8(BinaryTypeMarshallingMap.ConfigCommentRuleNode);

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
