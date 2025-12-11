import { type Value, type HtmlFilteringRuleBody } from '../../../nodes';
import { BaseDeserializer } from '../../base-deserializer';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer';
import {
    FREQUENT_ADG_HTML_FILTERING_ATTRIBUTE_SERIALIZATION_MAP,
    FREQUENT_ADG_HTML_FILTERING_PSEUDO_CLASS_SERIALIZATION_MAP,
} from '../../../marshalling-utils/cosmetic/body/adg-html-filtering-body-common';
import { HtmlFilteringBodyDeserializer } from './html-filtering-body-deserializer';

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let frequentAdgAttributeNameDeserializationMap: Map<number, string>;
const getFrequentAdgAttributeNameDeserializationMap = () => {
    if (!frequentAdgAttributeNameDeserializationMap) {
        frequentAdgAttributeNameDeserializationMap = new Map<number, string>(
            Array.from(FREQUENT_ADG_HTML_FILTERING_ATTRIBUTE_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }

    return frequentAdgAttributeNameDeserializationMap;
};

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let frequentAdgPseudoClassDeserializationMap: Map<number, string>;
const getFrequentAdgPseudoClassDeserializationMap = () => {
    if (!frequentAdgPseudoClassDeserializationMap) {
        frequentAdgPseudoClassDeserializationMap = new Map<number, string>(
            Array.from(FREQUENT_ADG_HTML_FILTERING_PSEUDO_CLASS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }

    return frequentAdgPseudoClassDeserializationMap;
};

/**
 * Deserializer for AdGuard HTML filtering rule body nodes.
 * Converts binary data into a structured HTML filtering rule body node specific to AdGuard,
 * using a predefined deserialization map for frequently used attribute names.
 */
export class AdgHtmlFilteringBodyDeserializer extends BaseDeserializer {
    /**
     * Deserializes a HTML filtering rule body node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     *
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<Value | HtmlFilteringRuleBody>): void {
        HtmlFilteringBodyDeserializer.deserialize(
            buffer,
            node,
            getFrequentAdgAttributeNameDeserializationMap(),
            getFrequentAdgPseudoClassDeserializationMap(),
        );
    }
}
