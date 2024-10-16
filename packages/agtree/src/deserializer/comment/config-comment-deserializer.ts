/* eslint-disable no-param-reassign */
import { NULL } from '../../utils/constants';
import {
    type ConfigCommentRule,
    BinaryTypeMap,
    type ConfigNode,
    CommentRuleType,
    RuleCategory,
    type ParameterList,
    type Value,
} from '../../nodes';
import { BaseDeserializer } from '../base-deserializer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import {
    ConfigCommentRuleSerializationMap,
    ConfigNodeSerializationMap,
    FREQUENT_COMMANDS_SERIALIZATION_MAP,
} from '../../serialization-utils/comment/config-comment-common';
import { AdblockSyntax } from '../../utils/adblockers';
import { ValueDeserializer } from '../misc/value-deserializer';
import { ParameterListDeserializer } from '../misc/parameter-list-deserializer';

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let FREQUENT_COMMANDS_DESERIALIZATION_MAP: Map<number, string>;
export const getFrequentPlatformsDeserializationMap = () => {
    if (!FREQUENT_COMMANDS_DESERIALIZATION_MAP) {
        FREQUENT_COMMANDS_DESERIALIZATION_MAP = new Map<number, string>(
            Array.from(FREQUENT_COMMANDS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }

    return FREQUENT_COMMANDS_DESERIALIZATION_MAP;
};

/**
 * `ConfigCommentDeserializer` is responsible for deserializing inline AGLint configuration rules.
 * Generally, the idea is inspired by ESLint inline configuration comments.
 *
 * @see {@link https://eslint.org/docs/latest/user-guide/configuring/rules#using-configuration-comments}
 */
export class ConfigCommentDeserializer extends BaseDeserializer {
    /**
     * Deserializes a metadata comment node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    private static deserializeConfigNode(buffer: InputByteBuffer, node: Partial<ConfigNode>): void {
        buffer.assertUint8(BinaryTypeMap.ConfigNode);

        node.type = 'ConfigNode';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ConfigNodeSerializationMap.Value:
                    // note: it is safe to use JSON.parse here, because we serialized it with JSON.stringify
                    node.value = JSON.parse(buffer.readString());
                    break;

                case ConfigNodeSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ConfigNodeSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}.`);
            }

            prop = buffer.readUint8();
        }
    }

    /**
     * Deserializes a metadata comment node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<ConfigCommentRule>): void {
        buffer.assertUint8(BinaryTypeMap.ConfigCommentRuleNode);

        node.type = CommentRuleType.ConfigCommentRule;
        node.category = RuleCategory.Comment;
        node.syntax = AdblockSyntax.Common;

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case ConfigCommentRuleSerializationMap.Marker:
                    ValueDeserializer.deserialize(buffer, node.marker = {} as Value);
                    break;

                case ConfigCommentRuleSerializationMap.Command:
                    // eslint-disable-next-line max-len
                    ValueDeserializer.deserialize(buffer, node.command = {} as Value, getFrequentPlatformsDeserializationMap());
                    break;

                case ConfigCommentRuleSerializationMap.Params:
                    if (buffer.peekUint8() === BinaryTypeMap.ConfigNode) {
                        ConfigCommentDeserializer.deserializeConfigNode(buffer, node.params = {} as ConfigNode);
                    } else {
                        ParameterListDeserializer.deserialize(buffer, node.params = {} as ParameterList);
                    }
                    break;

                case ConfigCommentRuleSerializationMap.Comment:
                    ValueDeserializer.deserialize(buffer, node.comment = {} as Value);
                    break;

                case ConfigCommentRuleSerializationMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case ConfigCommentRuleSerializationMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
