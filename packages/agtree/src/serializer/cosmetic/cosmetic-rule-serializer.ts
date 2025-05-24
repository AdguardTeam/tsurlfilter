import { AdblockSyntax } from '../../utils/adblockers.js';
import { DomainListSerializer } from '../misc/domain-list-serializer.js';
import { NULL } from '../../utils/constants.js';
import { type AnyCosmeticRule, CosmeticRuleType } from '../../nodes/index.js';
import { AbpSnippetInjectionBodySerializer } from './body/abp-snippet-injection-body-serializer.js';
import { UboScriptletInjectionBodySerializer } from './body/ubo-scriptlet-injection-body-serializer.js';
import { AdgScriptletInjectionBodySerializer } from './body/adg-scriptlet-injection-body-serializer.js';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer.js';
import { ValueSerializer } from '../misc/value-serializer.js';
import { isUndefined } from '../../utils/type-guards.js';
import { BaseSerializer } from '../base-serializer.js';
import { ElementHidingBodySerializer } from './element-hiding-body-serializer.js';
import { CssInjectionBodySerializer } from './css-injection-body-serializer.js';
import { ModifierListSerializer } from '../misc/modifier-list-serializer.js';
import {
    CosmeticRuleMarshallingMap,
    COSMETIC_RULE_SEPARATOR_SERIALIZATION_MAP,
} from '../../marshalling-utils/cosmetic/cosmetic-rule-common.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';
import { getSyntaxSerializationMap } from '../../marshalling-utils/syntax-serialization-map.js';

/**
 * `CosmeticRuleSerializer` is responsible for serializing cosmetic rules into a binary format.
 *
 * This class takes a cosmetic rule Abstract Syntax Tree (AST) and converts it into a compact binary representation.
 * It handles the serialization of different types of cosmetic rules, including element hiding, CSS injection,
 * JavaScript injection, HTML filtering, and scriptlet injection rules.
 */
export class CosmeticRuleSerializer extends BaseSerializer {
    /**
     * Serializes a cosmetic rule node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    // TODO: add support for raws, if ever needed
    public static serialize(node: AnyCosmeticRule, buffer: OutputByteBuffer): void {
        // specific properties
        switch (node.type) {
            case CosmeticRuleType.ElementHidingRule:
                // rule type
                buffer.writeUint8(BinaryTypeMarshallingMap.ElementHidingRule);
                // syntax
                buffer.writeUint8(getSyntaxSerializationMap().get(node.syntax) ?? 0);
                // rule body
                ElementHidingBodySerializer.serialize(node.body, buffer);
                break;

            case CosmeticRuleType.CssInjectionRule:
                // rule type
                buffer.writeUint8(BinaryTypeMarshallingMap.CssInjectionRule);
                // syntax
                buffer.writeUint8(getSyntaxSerializationMap().get(node.syntax) ?? 0);
                // rule body
                CssInjectionBodySerializer.serialize(node.body, buffer);
                break;

            case CosmeticRuleType.JsInjectionRule:
                // rule type
                buffer.writeUint8(BinaryTypeMarshallingMap.JsInjectionRule);
                // syntax
                buffer.writeUint8(getSyntaxSerializationMap().get(node.syntax) ?? 0);
                // rule body
                ValueSerializer.serialize(node.body, buffer);
                break;

            case CosmeticRuleType.HtmlFilteringRule:
                // rule type
                buffer.writeUint8(BinaryTypeMarshallingMap.HtmlFilteringRule);
                // syntax
                buffer.writeUint8(getSyntaxSerializationMap().get(node.syntax) ?? 0);
                // rule body
                ValueSerializer.serialize(node.body, buffer);
                break;

            case CosmeticRuleType.ScriptletInjectionRule:
                // rule type
                buffer.writeUint8(BinaryTypeMarshallingMap.ScriptletInjectionRule);
                // syntax
                buffer.writeUint8(getSyntaxSerializationMap().get(node.syntax) ?? 0);
                // rule body
                switch (node.syntax) {
                    case AdblockSyntax.Adg:
                        AdgScriptletInjectionBodySerializer.serialize(node.body, buffer);
                        break;

                    case AdblockSyntax.Abp:
                        AbpSnippetInjectionBodySerializer.serialize(node.body, buffer);
                        break;

                    case AdblockSyntax.Ubo:
                        UboScriptletInjectionBodySerializer.serialize(node.body, buffer);
                        break;

                    default:
                        throw new Error('Scriptlet rule should have an explicit syntax');
                }
                break;

            default:
                throw new Error('Unknown cosmetic rule type');
        }

        // common properties
        buffer.writeUint8(CosmeticRuleMarshallingMap.Exception);
        buffer.writeUint8(node.exception ? 1 : 0);

        buffer.writeUint8(CosmeticRuleMarshallingMap.Separator);
        ValueSerializer.serialize(node.separator, buffer, COSMETIC_RULE_SEPARATOR_SERIALIZATION_MAP);

        if (node.modifiers) {
            buffer.writeUint8(CosmeticRuleMarshallingMap.Modifiers);
            ModifierListSerializer.serialize(node.modifiers, buffer);
        }

        buffer.writeUint8(CosmeticRuleMarshallingMap.Domains);
        DomainListSerializer.serialize(node.domains, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(CosmeticRuleMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(CosmeticRuleMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
