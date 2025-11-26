import {
    type HtmlFilteringRuleSelector,
    type HtmlFilteringRuleBody,
    type HtmlFilteringRuleSelectorAttribute,
    type HtmlFilteringRuleSelectorPseudoClass,
} from '../../../nodes';
import { type OutputByteBuffer } from '../../../utils/output-byte-buffer';
import { NULL, UINT8_MAX } from '../../../utils/constants';
import { isUndefined } from '../../../utils/type-guards';
import { BaseSerializer } from '../../base-serializer';
import { BinaryTypeMarshallingMap } from '../../../marshalling-utils/misc/binary-type-common';
import { HtmlFilteringBodyMarshallingMap } from '../../../marshalling-utils/cosmetic/body/html-filtering-body-common';
import { ValueSerializer } from '../../misc/value-serializer';

/**
 * Serializer for HTML filtering rule body nodes.
 */
export class HtmlFilteringBodySerializer extends BaseSerializer {
    /**
     * Serializes a HTML filtering rule body node into a compact binary format.
     *
     * @param node The HtmlFilteringRuleBody node to serialize.
     * @param buffer The OutputByteBuffer used for writing the binary data.
     * @param frequentAttributes An optional map of frequently used attribute names,
     * along with their corresponding serialization index.
     * @param frequentPseudoClasses An optional map of frequently used pseudo-class names,
     * along with their corresponding serialization index.
     *
     * @note We write lengths of arrays, because it helps to optimize the deserialization process.
     */
    public static serialize(
        node: HtmlFilteringRuleBody,
        buffer: OutputByteBuffer,
        frequentAttributes?: Map<string, number>,
        frequentPseudoClasses?: Map<string, number>,
    ): void {
        // Write node type
        buffer.writeUint8(BinaryTypeMarshallingMap.HtmlFilteringRuleBody);

        // Write selectors length
        HtmlFilteringBodySerializer.writeArray(
            buffer,
            HtmlFilteringBodyMarshallingMap.Selectors,
            node.selectors,
            'selectors',
        );

        // Write selectors
        for (const selector of node.selectors) {
            HtmlFilteringBodySerializer.deserializeSelector(
                selector,
                buffer,
                frequentAttributes,
                frequentPseudoClasses,
            );
        }

        // Write body start position
        if (!isUndefined(node.start)) {
            buffer.writeUint8(HtmlFilteringBodyMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        // Write body end position
        if (!isUndefined(node.end)) {
            buffer.writeUint8(HtmlFilteringBodyMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        // Write null terminator
        buffer.writeUint8(NULL);
    }

    /**
     * Serializes a HTML filtering rule selector node into a compact binary format.
     *
     * @param node The HtmlFilteringRuleSelector node to serialize.
     * @param buffer The OutputByteBuffer used for writing the binary data.
     * @param frequentAttributes An optional map of frequently used attribute names,
     * along with their corresponding serialization index.
     * @param frequentPseudoClasses An optional map of frequently used pseudo-class names,
     * along with their corresponding serialization index.
     */
    private static deserializeSelector(
        node: HtmlFilteringRuleSelector,
        buffer: OutputByteBuffer,
        frequentAttributes?: Map<string, number>,
        frequentPseudoClasses?: Map<string, number>,
    ): void {
        // Write selector header
        buffer.writeUint8(HtmlFilteringBodyMarshallingMap.Selector);

        // Write tag name
        if (!isUndefined(node.tagName)) {
            buffer.writeUint8(HtmlFilteringBodyMarshallingMap.TagName);
            ValueSerializer.serialize(node.tagName, buffer);
        }

        // Write attributes length
        HtmlFilteringBodySerializer.writeArray(
            buffer,
            HtmlFilteringBodyMarshallingMap.Attributes,
            node.attributes,
            'attributes',
        );

        // Write attributes
        for (const attribute of node.attributes) {
            HtmlFilteringBodySerializer.deserializeAttribute(
                attribute,
                buffer,
                frequentAttributes,
            );
        }

        // Write pseudo classes length
        HtmlFilteringBodySerializer.writeArray(
            buffer,
            HtmlFilteringBodyMarshallingMap.PseudoClasses,
            node.pseudoClasses,
            'pseudo classes',
        );

        // Write pseudo classes
        for (const pseudoClass of node.pseudoClasses) {
            HtmlFilteringBodySerializer.deserializePseudoClass(
                pseudoClass,
                buffer,
                frequentPseudoClasses,
            );
        }

        // Write selector start position
        if (!isUndefined(node.start)) {
            buffer.writeUint8(HtmlFilteringBodyMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        // Write selector end position
        if (!isUndefined(node.end)) {
            buffer.writeUint8(HtmlFilteringBodyMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        // Write null terminator
        buffer.writeUint8(NULL);
    }

    /**
     * Serializes a HTML filtering rule selector attribute node into a compact binary format.
     *
     * @param node The HtmlFilteringRuleSelectorAttribute node to serialize.
     * @param buffer The OutputByteBuffer used for writing the binary data.
     * @param frequentAttributes An optional map of frequently used attribute names,
     * along with their corresponding serialization index.
     */
    private static deserializeAttribute(
        node: HtmlFilteringRuleSelectorAttribute,
        buffer: OutputByteBuffer,
        frequentAttributes?: Map<string, number>,
    ): void {
        // Write attribute header
        buffer.writeUint8(HtmlFilteringBodyMarshallingMap.Attribute);

        // Write attribute name
        buffer.writeUint8(HtmlFilteringBodyMarshallingMap.AttributeName);
        ValueSerializer.serialize(node.name, buffer, frequentAttributes, true);

        // Write attribute value
        if (!isUndefined(node.value)) {
            buffer.writeUint8(HtmlFilteringBodyMarshallingMap.AttributeValue);
            ValueSerializer.serialize(node.value, buffer);
        }

        // Write attribute flags
        if (!isUndefined(node.flags)) {
            buffer.writeUint8(HtmlFilteringBodyMarshallingMap.AttributeFlags);
            ValueSerializer.serialize(node.flags, buffer);
        }

        // Write attribute start position
        if (!isUndefined(node.start)) {
            buffer.writeUint8(HtmlFilteringBodyMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        // Write attribute end position
        if (!isUndefined(node.end)) {
            buffer.writeUint8(HtmlFilteringBodyMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        // Write null terminator
        buffer.writeUint8(NULL);
    }

    /**
     * Serializes a HTML filtering rule selector pseudo-class node into a compact binary format.
     *
     * @param node The HtmlFilteringRuleSelectorPseudoClass node to serialize.
     * @param buffer The OutputByteBuffer used for writing the binary data.
     * @param frequentPseudoClasses An optional map of frequently used pseudo-class names,
     * along with their corresponding serialization index.
     */
    private static deserializePseudoClass(
        node: HtmlFilteringRuleSelectorPseudoClass,
        buffer: OutputByteBuffer,
        frequentPseudoClasses?: Map<string, number>,
    ): void {
        // Write pseudo class header
        buffer.writeUint8(HtmlFilteringBodyMarshallingMap.PseudoClass);

        // Write pseudo class name
        buffer.writeUint8(HtmlFilteringBodyMarshallingMap.PseudoClassName);
        ValueSerializer.serialize(node.name, buffer, frequentPseudoClasses, true);

        // Write pseudo class content
        buffer.writeUint8(HtmlFilteringBodyMarshallingMap.PseudoClassContent);
        ValueSerializer.serialize(node.content, buffer);

        // Write pseudo class start position
        if (!isUndefined(node.start)) {
            buffer.writeUint8(HtmlFilteringBodyMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        // Write pseudo class end position
        if (!isUndefined(node.end)) {
            buffer.writeUint8(HtmlFilteringBodyMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        // Write null terminator
        buffer.writeUint8(NULL);
    }

    /**
     * Writes an array header to the buffer.
     *
     * @param buffer The OutputByteBuffer used for writing the binary data.
     * @param marshallingMapKey The marshalling map key representing the array property.
     * @param array The array whose length is to be written.
     * @param kind A string representing the kind of items in the array (for error messages).
     */
    private static writeArray(
        buffer: OutputByteBuffer,
        marshallingMapKey: HtmlFilteringBodyMarshallingMap,
        array: unknown[],
        kind: string,
    ): void {
        buffer.writeUint8(marshallingMapKey);
        const { length } = array;
        if (length > UINT8_MAX) {
            throw new Error(`Too many ${kind}: ${length}, the limit is ${UINT8_MAX}`);
        }
        buffer.writeUint8(length);
    }
}
