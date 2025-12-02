/* eslint-disable no-param-reassign */
import {
    type HtmlFilteringRuleSelector,
    type HtmlFilteringRuleBody,
    type HtmlFilteringRuleSelectorAttribute,
    type HtmlFilteringRuleSelectorPseudoClass,
    type Value,
    type HtmlFilteringRuleSelectorList,
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
                case HtmlFilteringBodyMarshallingMap.SelectorList:
                    node.children = new Array(buffer.readUint8());
                    for (let i = 0; i < node.children.length; i += 1) {
                        HtmlFilteringBodyDeserializer.deserializeSelectorList(
                            buffer,
                            node.children[i] = {} as HtmlFilteringRuleSelectorList,
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
     * Deserializes a HTML filtering rule selector list node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @param frequentAttributes An optional map of frequently used attribute names,
     * along with their corresponding serialization index.
     * @param frequentPseudoClasses An optional map of frequently used pseudo-class names,
     * along with their corresponding serialization index.
     */
    private static deserializeSelectorList(
        buffer: InputByteBuffer,
        node: Partial<HtmlFilteringRuleSelectorList>,
        frequentAttributes?: Map<number, string>,
        frequentPseudoClasses?: Map<number, string>,
    ): void {
        buffer.assertUint8(HtmlFilteringBodyMarshallingMap.SelectorListItem);
        node.type = 'HtmlFilteringRuleSelectorList';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case HtmlFilteringBodyMarshallingMap.Selectors:
                    node.children = new Array(buffer.readUint8());
                    for (let i = 0; i < node.children.length; i += 1) {
                        HtmlFilteringBodyDeserializer.deserializeSelector(
                            buffer,
                            node.children[i] = {} as HtmlFilteringRuleSelector,
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
                    throw new Error(`Invalid selector list property: ${prop}`);
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
        buffer.assertUint8(HtmlFilteringBodyMarshallingMap.SelectorsItem);
        node.type = 'HtmlFilteringRuleSelector';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case HtmlFilteringBodyMarshallingMap.Parts:
                    node.children = new Array(buffer.readUint8());
                    for (let i = 0; i < node.children.length; i += 1) {
                        const partType = buffer.peekUint8();

                        switch (partType) {
                            case HtmlFilteringBodyMarshallingMap.Value:
                                buffer.assertUint8(HtmlFilteringBodyMarshallingMap.Value);
                                ValueDeserializer.deserialize(buffer, node.children[i] = {} as Value);
                                break;

                            case HtmlFilteringBodyMarshallingMap.Attribute:
                                HtmlFilteringBodyDeserializer.deserializeAttribute(
                                    buffer,
                                    node.children[i] = {} as HtmlFilteringRuleSelectorAttribute,
                                    frequentAttributes,
                                );
                                break;

                            case HtmlFilteringBodyMarshallingMap.PseudoClass:
                                HtmlFilteringBodyDeserializer.deserializePseudoClass(
                                    buffer,
                                    node.children[i] = {} as HtmlFilteringRuleSelectorPseudoClass,
                                    frequentPseudoClasses,
                                );
                                break;

                            default:
                                throw new Error(`Unknown selector part type: ${partType}`);
                        }
                    }
                    break;

                case HtmlFilteringBodyMarshallingMap.Combinator:
                    ValueDeserializer.deserialize(buffer, node.combinator = {} as Value);
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

                case HtmlFilteringBodyMarshallingMap.AttributeOperator:
                    ValueDeserializer.deserialize(buffer, node.operator = {} as Value);
                    break;

                case HtmlFilteringBodyMarshallingMap.AttributeValue:
                    ValueDeserializer.deserialize(buffer, node.value = {} as Value);
                    break;

                case HtmlFilteringBodyMarshallingMap.AttributeFlag:
                    ValueDeserializer.deserialize(buffer, node.flag = {} as Value);
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

                case HtmlFilteringBodyMarshallingMap.PseudoClassIsFunction:
                    node.isFunction = buffer.readUint8() !== 0;
                    break;

                case HtmlFilteringBodyMarshallingMap.PseudoClassArgument:
                    ValueDeserializer.deserialize(buffer, node.argument = {} as Value);
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
