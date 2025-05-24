import { AgentCommentDeserializer } from './agent-comment-deserializer.js';
import {
    type AgentCommentRule,
    type AnyCommentRule,
    type CommentRule,
    type ConfigCommentRule,
    type HintCommentRule,
    type MetadataCommentRule,
    type PreProcessorCommentRule,
} from '../../nodes/index.js';
import { ConfigCommentDeserializer } from './config-comment-deserializer.js';
import { HintCommentDeserializer } from './hint-comment-deserializer.js';
import { MetadataCommentDeserializer } from './metadata-comment-deserializer.js';
import { PreProcessorCommentDeserializer } from './pre-processor-comment-deserializer.js';
import { SimpleCommentDeserializer } from './simple-comment-deserializer.js';
import { BaseDeserializer } from '../base-deserializer.js';
import { type InputByteBuffer } from '../../utils/input-byte-buffer.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';

/**
 * `CommentRuleDeserializer` is responsible for deserializing any comment-like adblock rules.
 */
export class CommentRuleDeserializer extends BaseDeserializer {
    /**
     * Deserializes a comment rule node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<AnyCommentRule>): void {
        const type = buffer.peekUint8();

        switch (type) {
            case BinaryTypeMarshallingMap.AgentRuleNode:
                AgentCommentDeserializer.deserialize(buffer, node as Partial<AgentCommentRule>);
                return;

            case BinaryTypeMarshallingMap.HintRuleNode:
                HintCommentDeserializer.deserialize(buffer, node as Partial<HintCommentRule>);
                return;

            case BinaryTypeMarshallingMap.PreProcessorCommentRuleNode:
                PreProcessorCommentDeserializer.deserialize(buffer, node as Partial<PreProcessorCommentRule>);
                return;

            case BinaryTypeMarshallingMap.MetadataCommentRuleNode:
                MetadataCommentDeserializer.deserialize(buffer, node as Partial<MetadataCommentRule>);
                return;

            case BinaryTypeMarshallingMap.ConfigCommentRuleNode:
                ConfigCommentDeserializer.deserialize(buffer, node as Partial<ConfigCommentRule>);
                return;

            case BinaryTypeMarshallingMap.CommentRuleNode:
                SimpleCommentDeserializer.deserialize(buffer, node as Partial<CommentRule>);
                return;

            default:
                throw new Error(`Unknown comment rule type: ${type}`);
        }
    }
}
