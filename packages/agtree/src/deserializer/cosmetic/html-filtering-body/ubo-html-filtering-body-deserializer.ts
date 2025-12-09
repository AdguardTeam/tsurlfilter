import { type HtmlFilteringRuleBody } from '../../../nodes';
import { BaseDeserializer } from '../../base-deserializer';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer';
import {
    FREQUENT_UBO_HTML_FILTERING_PSEUDO_CLASS_SERIALIZATION_MAP,
} from '../../../marshalling-utils/cosmetic/body/ubo-html-filtering-body-common';
import { HtmlFilteringBodyDeserializer } from './html-filtering-body-deserializer';

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let frequentUboPseudoClassDeserializationMap: Map<number, string>;
const getFrequentUboPseudoClassDeserializationMap = () => {
    if (!frequentUboPseudoClassDeserializationMap) {
        frequentUboPseudoClassDeserializationMap = new Map<number, string>(
            Array.from(FREQUENT_UBO_HTML_FILTERING_PSEUDO_CLASS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }

    return frequentUboPseudoClassDeserializationMap;
};

/**
 * Deserializer for uBlock HTML filtering rule body nodes.
 * Converts binary data into a structured HTML filtering rule body node specific to uBlock,
 * using a predefined deserialization map for frequently used pseudo-class names.
 */
export class UboHtmlFilteringBodyDeserializer extends BaseDeserializer {
    /**
     * Deserializes a HTML filtering rule body node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     *
     * @throws If the binary data is malformed.
     */
    public static deserialize(buffer: InputByteBuffer, node: Partial<HtmlFilteringRuleBody>): void {
        HtmlFilteringBodyDeserializer.deserialize(
            buffer,
            node,
            undefined,
            getFrequentUboPseudoClassDeserializationMap(),
        );
    }
}
