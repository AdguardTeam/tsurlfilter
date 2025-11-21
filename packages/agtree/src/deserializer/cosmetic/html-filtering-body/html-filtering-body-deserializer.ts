/* eslint-disable no-param-reassign */
import {
    type HtmlFilteringRuleSelector,
    type HtmlFilteringRuleBody,
    type HtmlFilteringRuleSelectorAttribute,
    type HtmlFilteringRuleSelectorPseudoClass,
    type Value,
} from '../../../nodes';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer';
import { NULL } from '../../../utils/constants';
import { BaseDeserializer } from '../../base-deserializer';
import { BinaryTypeMarshallingMap } from '../../../marshalling-utils/misc/binary-type-common';
import { HtmlFilteringBodyMarshallingMap } from '../../../marshalling-utils/cosmetic/body/html-filtering-body-common';
import { ValueDeserializer } from '../../misc/value-deserializer';

/**
 * Deserializes binary data into HTML filtering rule body nodes.
 * Optionally uses a map of frequently used attribute names or pseudo class names.
 */
export class HtmlFilteringBodyDeserializer extends BaseDeserializer {
    /**
     * Deserializes a HTML filtering rule node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @param frequentAttributes An optional map of frequently used attribute names,
     * along with their corresponding serialization index.
     * @param frequentPseudoClasses An optional map of frequently used pseudo-class names,
     * along with their corresponding serialization index.
     *
     * @throws If the binary data is malformed.
     */
    public static deserialize(
        buffer: InputByteBuffer,
        node: Partial<HtmlFilteringRuleBody>,
        frequentAttributes?: Map<number, string>,
        frequentPseudoClasses?: Map<number, string>,
    ): void {
        buffer.assertUint8(BinaryTypeMarshallingMap.HtmlFilteringRuleBody);
        node.type = 'HtmlFilteringRuleBody';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case HtmlFilteringBodyMarshallingMap.Selectors:
                    node.selectors = new Array(buffer.readUint8());
                    for (let i = 0; i < node.selectors.length; i += 1) {
                        HtmlFilteringBodyDeserializer.deserializeSelector(
                            buffer,
                            node.selectors[i] = {} as HtmlFilteringRuleSelector,
                            frequentAttributes,
                            frequentPseudoClasses,
                        );
                    }
                    break;

                case HtmlFilteringBodyMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case HtmlFilteringBodyMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }

    /**
     * Deserializes a HTML filtering rule selector node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @param frequentAttributes An optional map of frequently used attribute names,
     * along with their corresponding serialization index.
     * @param frequentPseudoClasses An optional map of frequently used pseudo-class names,
     * along with their corresponding serialization index.
     */
    private static deserializeSelector(
        buffer: InputByteBuffer,
        node: Partial<HtmlFilteringRuleSelector>,
        frequentAttributes?: Map<number, string>,
        frequentPseudoClasses?: Map<number, string>,
    ): void {
        buffer.assertUint8(HtmlFilteringBodyMarshallingMap.Selector);
        node.type = 'HtmlFilteringRuleSelector';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case HtmlFilteringBodyMarshallingMap.TagName:
                    ValueDeserializer.deserialize(buffer, node.tagName = {} as Value);
                    break;

                case HtmlFilteringBodyMarshallingMap.Attributes:
                    node.attributes = new Array(buffer.readUint8());
                    for (let i = 0; i < node.attributes.length; i += 1) {
                        HtmlFilteringBodyDeserializer.deserializeAttribute(
                            buffer,
                            node.attributes[i] = {} as HtmlFilteringRuleSelectorAttribute,
                            frequentAttributes,
                        );
                    }
                    break;

                case HtmlFilteringBodyMarshallingMap.PseudoClasses:
                    node.pseudoClasses = new Array(buffer.readUint8());
                    for (let i = 0; i < node.pseudoClasses.length; i += 1) {
                        HtmlFilteringBodyDeserializer.deserializePseudoClass(
                            buffer,
                            node.pseudoClasses[i] = {} as HtmlFilteringRuleSelectorPseudoClass,
                            frequentPseudoClasses,
                        );
                    }
                    break;

                case HtmlFilteringBodyMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case HtmlFilteringBodyMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid selector property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }

    /**
     * Deserializes a HTML filtering rule selector attribute node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @param frequentAttributes An optional map of frequently used attribute names,
     * along with their corresponding serialization index.
     */
    private static deserializeAttribute(
        buffer: InputByteBuffer,
        node: Partial<HtmlFilteringRuleSelectorAttribute>,
        frequentAttributes?: Map<number, string>,
    ): void {
        buffer.assertUint8(HtmlFilteringBodyMarshallingMap.Attribute);
        node.type = 'HtmlFilteringRuleSelectorAttribute';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case HtmlFilteringBodyMarshallingMap.AttributeName:
                    ValueDeserializer.deserialize(
                        buffer,
                        node.name = {} as Value,
                        frequentAttributes,
                    );
                    break;

                case HtmlFilteringBodyMarshallingMap.AttributeValue:
                    ValueDeserializer.deserialize(buffer, node.value = {} as Value);
                    break;

                case HtmlFilteringBodyMarshallingMap.AttributeFlags:
                    ValueDeserializer.deserialize(buffer, node.flags = {} as Value);
                    break;

                case HtmlFilteringBodyMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case HtmlFilteringBodyMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid attribute property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }

    /**
     * Deserializes a HTML filtering rule selector pseudo class node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @param frequentPseudoClasses An optional map of frequently used pseudo-class names,
     * along with their corresponding serialization index.
     */
    private static deserializePseudoClass(
        buffer: InputByteBuffer,
        node: Partial<HtmlFilteringRuleSelectorPseudoClass>,
        frequentPseudoClasses?: Map<number, string>,
    ): void {
        buffer.assertUint8(HtmlFilteringBodyMarshallingMap.PseudoClass);
        node.type = 'HtmlFilteringRuleSelectorPseudoClass';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case HtmlFilteringBodyMarshallingMap.PseudoClassName:
                    ValueDeserializer.deserialize(
                        buffer,
                        node.name = {} as Value,
                        frequentPseudoClasses,
                    );
                    break;

                case HtmlFilteringBodyMarshallingMap.PseudoClassContent:
                    ValueDeserializer.deserialize(buffer, node.content = {} as Value);
                    break;

                case HtmlFilteringBodyMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case HtmlFilteringBodyMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid pseudo class property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
