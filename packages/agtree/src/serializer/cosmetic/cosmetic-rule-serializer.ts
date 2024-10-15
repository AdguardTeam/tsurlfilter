import { AdblockSyntax } from '../../utils/adblockers';
import { DomainListSerializer } from '../misc/domain-list-serializer';
import { NULL } from '../../utils/constants';
import {
    type AnyCosmeticRule,
    CosmeticRuleType,
    BinaryTypeMap,
    getSyntaxSerializationMap,
} from '../../nodes';
import { AbpSnippetInjectionBodySerializer } from './body/abp-snippet-injection-body-serializer';
import { UboScriptletInjectionBodySerializer } from './body/ubo-scriptlet-injection-body-serializer';
import { AdgScriptletInjectionBodySerializer } from './body/adg-scriptlet-injection-body-serializer';
import { type OutputByteBuffer } from '../../utils/output-byte-buffer';
import { ValueSerializer } from '../misc/value-serializer';
import { isUndefined } from '../../utils/type-guards';
import { BINARY_SCHEMA_VERSION } from '../../utils/binary-schema-version';
import { BaseSerializer } from '../base-serializer';
import { ElementHidingBodySerializer } from './element-hiding-body-serializer';
import { CssInjectionBodySerializer } from './css-injection-body-serializer';
import { ModifierListSerializer } from '../misc/modifier-list-serializer';

/**
 * Value map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const SEPARATOR_SERIALIZATION_MAP = new Map<string, number>([
    ['##', 0],
    ['#@#', 1],

    ['#?#', 2],
    ['#@?#', 3],

    ['#$#', 4],
    ['#$?#', 5],
    ['#@$#', 6],
    ['#@$?#', 7],

    ['#%#', 8],
    ['#@%#', 9],

    ['$$', 10],
    ['$@$', 11],
]);

/**
 * Property map for binary serialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent a property.
 *
 * ! IMPORTANT: If you change values here, please update the {@link BINARY_SCHEMA_VERSION}!
 *
 * @note Only 256 values can be represented this way.
 */
const enum CosmeticRuleSerializationMap {
    Syntax = 1,
    Exception,
    Separator,
    Modifiers,
    Domains,
    Body,
    Start,
    End,
}

/**
 * `CosmeticRuleParser` is responsible for parsing cosmetic rules.
 *
 * Where possible, it automatically detects the difference between supported syntaxes:
 *  - AdGuard
 *  - uBlock Origin
 *  - Adblock Plus
 *
 * If the syntax is common / cannot be determined, the parser gives `Common` syntax.
 *
 * Please note that syntactically correct rules are parsed even if they are not actually
 * compatible with the given adblocker. This is a completely natural behavior, meaningful
 * checking of compatibility is not done at the parser level.
 */
// TODO: Make raw body parsing optional
// TODO: Split into smaller sections
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
                buffer.writeUint8(BinaryTypeMap.ElementHidingRule);
                // syntax
                buffer.writeUint8(getSyntaxSerializationMap().get(node.syntax) ?? 0);
                // rule body
                ElementHidingBodySerializer.serialize(node.body, buffer);
                break;

            case CosmeticRuleType.CssInjectionRule:
                // rule type
                buffer.writeUint8(BinaryTypeMap.CssInjectionRule);
                // syntax
                buffer.writeUint8(getSyntaxSerializationMap().get(node.syntax) ?? 0);
                // rule body
                CssInjectionBodySerializer.serialize(node.body, buffer);
                break;

            case CosmeticRuleType.JsInjectionRule:
                // rule type
                buffer.writeUint8(BinaryTypeMap.JsInjectionRule);
                // syntax
                buffer.writeUint8(getSyntaxSerializationMap().get(node.syntax) ?? 0);
                // rule body
                ValueSerializer.serialize(node.body, buffer);
                break;

            case CosmeticRuleType.HtmlFilteringRule:
                // rule type
                buffer.writeUint8(BinaryTypeMap.HtmlFilteringRule);
                // syntax
                buffer.writeUint8(getSyntaxSerializationMap().get(node.syntax) ?? 0);
                // rule body
                ValueSerializer.serialize(node.body, buffer);
                break;

            case CosmeticRuleType.ScriptletInjectionRule:
                // rule type
                buffer.writeUint8(BinaryTypeMap.ScriptletInjectionRule);
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
        buffer.writeUint8(CosmeticRuleSerializationMap.Exception);
        buffer.writeUint8(node.exception ? 1 : 0);

        buffer.writeUint8(CosmeticRuleSerializationMap.Separator);
        ValueSerializer.serialize(node.separator, buffer, SEPARATOR_SERIALIZATION_MAP);

        if (node.modifiers) {
            buffer.writeUint8(CosmeticRuleSerializationMap.Modifiers);
            ModifierListSerializer.serialize(node.modifiers, buffer);
        }

        buffer.writeUint8(CosmeticRuleSerializationMap.Domains);
        DomainListSerializer.serialize(node.domains, buffer);

        if (!isUndefined(node.start)) {
            buffer.writeUint8(CosmeticRuleSerializationMap.Start);
            buffer.writeUint32(node.start);
        }

        if (!isUndefined(node.end)) {
            buffer.writeUint8(CosmeticRuleSerializationMap.End);
            buffer.writeUint32(node.end);
        }

        buffer.writeUint8(NULL);
    }
}
