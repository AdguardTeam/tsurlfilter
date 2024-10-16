import {
    type AnyRule,
    BinaryTypeMap,
    type AnyCommentRule,
    type AnyCosmeticRule,
    type NetworkRule,
    type HostRule,
    type EmptyRule,
    type InvalidRule,
} from '../nodes';
import { BaseDeserializer } from './base-deserializer';
import { CommentRuleDeserializer } from './comment/comment-rule-deserializer';
import { CosmeticRuleDeserializer } from './cosmetic/cosmetic-rule-deserializer';
import { HostRuleDeserializer } from './network/host-rule-deserializer';
import { NetworkRuleDeserializer } from './network/network-rule-deserializer';
import { EmptyRuleDeserializer } from './empty-rule-deserializer';
import { InvalidRuleDeserializer } from './invalid-rule-deserializer';
import { type InputByteBuffer } from '../utils/input-byte-buffer';

/**
 * `RuleDeserializer` is responsible for deserializing the rules.
 *
 * It automatically determines the category and syntax of the rule, so you can pass any kind of rule to it.
 */
export class RuleDeserializer extends BaseDeserializer {
    /**
     * Deserializes a rule node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<AnyRule>): void {
        // lookup instead of storing +1 byte
        const type = buffer.peekUint8();
        switch (type) {
            case BinaryTypeMap.AgentRuleNode:
            case BinaryTypeMap.HintRuleNode:
            case BinaryTypeMap.PreProcessorCommentRuleNode:
            case BinaryTypeMap.MetadataCommentRuleNode:
            case BinaryTypeMap.ConfigCommentRuleNode:
            case BinaryTypeMap.CommentRuleNode:
                CommentRuleDeserializer.deserialize(buffer, node as AnyCommentRule);
                break;

            case BinaryTypeMap.ElementHidingRule:
            case BinaryTypeMap.CssInjectionRule:
            case BinaryTypeMap.ScriptletInjectionRule:
            case BinaryTypeMap.HtmlFilteringRule:
            case BinaryTypeMap.JsInjectionRule:
                CosmeticRuleDeserializer.deserialize(buffer, node as AnyCosmeticRule);
                break;

            case BinaryTypeMap.NetworkRuleNode:
                NetworkRuleDeserializer.deserialize(buffer, node as NetworkRule);
                break;

            case BinaryTypeMap.HostRuleNode:
                HostRuleDeserializer.deserialize(buffer, node as HostRule);
                break;

            case BinaryTypeMap.EmptyRule:
                EmptyRuleDeserializer.deserialize(buffer, node as EmptyRule);
                break;

            case BinaryTypeMap.InvalidRule:
                InvalidRuleDeserializer.deserialize(buffer, node as InvalidRule);
                break;

            default:
                throw new Error('Unknown rule category');
        }
    }
}
