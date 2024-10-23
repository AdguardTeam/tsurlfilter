import { AgentCommentDeserializer } from './agent-comment-deserializer';
import {
    type AgentCommentRule,
    type AnyCommentRule,
    type CommentRule,
    type ConfigCommentRule,
    type HintCommentRule,
    type MetadataCommentRule,
    type PreProcessorCommentRule,
} from '../../nodes';
import { ConfigCommentDeserializer } from './config-comment-deserializer';
import { HintCommentDeserializer } from './hint-comment-deserializer';
import { MetadataCommentDeserializer } from './metadata-comment-deserializer';
import { PreProcessorCommentDeserializer } from './pre-processor-comment-deserializer';
import { SimpleCommentDeserializer } from './simple-comment-deserializer';
import { BaseDeserializer } from '../base-deserializer';
import { type InputByteBuffer } from '../../utils/input-byte-buffer';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common';

/**
 * `CommentRuleSerializer` is responsible for serializing any comment-like adblock rules.
 *
 * @example
 * Example rules:
 *  - Adblock agent rules:
 *      - ```adblock
 *        [AdGuard]
 *        ```
 *      - ```adblock
 *        [Adblock Plus 2.0]
 *        ```
 *      - etc.
 *  - AdGuard hint rules:
 *      - ```adblock
 *        !+ NOT_OPTIMIZED
 *        ```
 *      - ```adblock
 *        !+ NOT_OPTIMIZED PLATFORM(windows)
 *        ```
 *      - etc.
 *  - Pre-processor rules:
 *      - ```adblock
 *        !#if (adguard)
 *        ```
 *      - ```adblock
 *        !#endif
 *        ```
 *      - etc.
 *  - Metadata rules:
 *      - ```adblock
 *        ! Title: My List
 *        ```
 *      - ```adblock
 *        ! Version: 2.0.150
 *        ```
 *      - etc.
 *  - AGLint inline config rules:
 *      - ```adblock
 *        ! aglint-enable some-rule
 *        ```
 *      - ```adblock
 *        ! aglint-disable some-rule
 *        ```
 *      - etc.
 *  - Simple comments:
 *      - Regular version:
 *        ```adblock
 *        ! This is just a comment
 *        ```
 *      - uBlock Origin / "hostlist" version:
 *        ```adblock
 *        # This is just a comment
 *        ```
 *      - etc.
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
