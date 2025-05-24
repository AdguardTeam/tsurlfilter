/* eslint-disable no-param-reassign */
import { AdblockSyntax } from '../../utils/adblockers.js';
import { DomainListDeserializer } from '../misc/domain-list-deserializer.js';
import { NULL } from '../../utils/constants.js';
import {
    type AnyCosmeticRule,
    CosmeticRuleType,
    type ElementHidingRuleBody,
    type CssInjectionRuleBody,
    type Value,
    RuleCategory,
    type ScriptletInjectionRuleBody,
    type DomainList,
    type ModifierList,
} from '../../nodes/index.js';
import { AbpSnippetInjectionBodyDeserializer } from './scriptlet-body/abp-snippet-injection-body-deserializer.js';
import { UboScriptletInjectionBodyDeserializer } from './scriptlet-body/ubo-scriptlet-injection-body-deserializer.js';
import { AdgScriptletInjectionBodyDeserializer } from './scriptlet-body/adg-scriptlet-injection-body-deserializer.js';
import { ValueDeserializer } from '../misc/value-deserializer.js';
import { isUndefined } from '../../utils/type-guards.js';
import { BaseDeserializer } from '../base-deserializer.js';
import { ElementHidingBodyDeserializer } from './element-hiding-body-deserializer.js';
import { CssInjectionBodyDeserializer } from './css-injection-body-deserializer.js';
import { ModifierListDeserializer } from '../misc/modifier-list-deserializer.js';
import { type InputByteBuffer } from '../../utils/input-byte-buffer.js';
import {
    CosmeticRuleMarshallingMap,
    COSMETIC_RULE_SEPARATOR_SERIALIZATION_MAP,
} from '../../marshalling-utils/cosmetic/cosmetic-rule-common.js';
import { BinaryTypeMarshallingMap } from '../../marshalling-utils/misc/binary-type-common.js';
import { getSyntaxDeserializationMap } from '../syntax-deserialization-map.js';

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let cosmeticRuleSeparatorDeserializationMap: Map<number, string>;
const getCosmeticRuleSeparatorDeserializationMap = () => {
    if (!cosmeticRuleSeparatorDeserializationMap) {
        cosmeticRuleSeparatorDeserializationMap = new Map<number, string>(
            Array.from(COSMETIC_RULE_SEPARATOR_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }

    return cosmeticRuleSeparatorDeserializationMap;
};

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
const COSMETIC_RULE_TYPE_DESERIALIZATION_MAP = new Map<BinaryTypeMarshallingMap, CosmeticRuleType>([
    [BinaryTypeMarshallingMap.ElementHidingRule, CosmeticRuleType.ElementHidingRule],
    [BinaryTypeMarshallingMap.CssInjectionRule, CosmeticRuleType.CssInjectionRule],
    [BinaryTypeMarshallingMap.ScriptletInjectionRule, CosmeticRuleType.ScriptletInjectionRule],
    [BinaryTypeMarshallingMap.JsInjectionRule, CosmeticRuleType.JsInjectionRule],
    [BinaryTypeMarshallingMap.HtmlFilteringRule, CosmeticRuleType.HtmlFilteringRule],
]);

/**
 * Deserializer for cosmetic rules.
 * Converts binary data into structured cosmetic rule nodes, supporting various types
 * like element hiding, CSS injection, scriptlet injection, JavaScript injection, and HTML filtering.
 * Handles rule type, syntax, exceptions, separators, modifiers, and domain lists.
 */
export class CosmeticRuleDeserializer extends BaseDeserializer {
    /**
     * Deserializes a cosmetic rule node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<AnyCosmeticRule>): void {
        const type = COSMETIC_RULE_TYPE_DESERIALIZATION_MAP.get(buffer.readUint8() as BinaryTypeMarshallingMap);
        if (isUndefined(type)) {
            throw new Error(`Unknown rule type: ${type}`);
        }
        node.type = type;

        node.category = RuleCategory.Cosmetic;

        const syntax = getSyntaxDeserializationMap().get(buffer.readUint8()) ?? AdblockSyntax.Common;
        node.syntax = syntax;

        node.modifiers = undefined;

        switch (type) {
            case CosmeticRuleType.ElementHidingRule:
                ElementHidingBodyDeserializer.deserializeElementHidingBody(
                    buffer,
                    node.body = {} as ElementHidingRuleBody,
                );
                break;

            case CosmeticRuleType.CssInjectionRule:
                CssInjectionBodyDeserializer.deserialize(buffer, node.body = {} as CssInjectionRuleBody);
                break;

            case CosmeticRuleType.JsInjectionRule:
                ValueDeserializer.deserialize(buffer, node.body = {} as Value);
                break;

            case CosmeticRuleType.HtmlFilteringRule:
                ValueDeserializer.deserialize(buffer, node.body = {} as Value);
                break;

            case CosmeticRuleType.ScriptletInjectionRule:
                switch (syntax) {
                    case AdblockSyntax.Adg:
                        AdgScriptletInjectionBodyDeserializer.deserialize(
                            buffer,
                            node.body = {} as ScriptletInjectionRuleBody,
                        );
                        break;

                    case AdblockSyntax.Abp:
                        AbpSnippetInjectionBodyDeserializer.deserialize(
                            buffer,
                            node.body = {} as ScriptletInjectionRuleBody,
                        );
                        break;

                    case AdblockSyntax.Ubo:
                        UboScriptletInjectionBodyDeserializer.deserialize(
                            buffer,
                            node.body = {} as ScriptletInjectionRuleBody,
                        );
                        break;

                    default:
                        throw new Error('Scriptlet rule should have an explicit syntax');
                }
                break;

            default:
                throw new Error('Unknown cosmetic rule type');
        }

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case CosmeticRuleMarshallingMap.Exception:
                    node.exception = buffer.readUint8() === 1;
                    break;

                case CosmeticRuleMarshallingMap.Separator:
                    ValueDeserializer.deserialize(
                        buffer,
                        node.separator = {} as Value,
                        getCosmeticRuleSeparatorDeserializationMap(),
                    );
                    break;

                case CosmeticRuleMarshallingMap.Modifiers:
                    node.modifiers = {} as ModifierList;
                    ModifierListDeserializer.deserialize(buffer, node.modifiers);
                    break;

                case CosmeticRuleMarshallingMap.Domains:
                    DomainListDeserializer.deserialize(buffer, node.domains = {} as DomainList);
                    break;

                case CosmeticRuleMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case CosmeticRuleMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Unknown property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
