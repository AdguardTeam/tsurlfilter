/* eslint-disable no-param-reassign */
import {
    CssSelectorMarshallingMap,
    FREQUENT_CSS_COMBINATORS_SERIALIZATION_MAP,
} from '../../../marshalling-utils/cosmetic/css-selector-common';
import {
    type CssSelectorCombinator,
    type Value,
    type CssComplexSelectorItem,
    type CssCompoundSelector,
} from '../../../nodes';
import { NULL } from '../../../utils/constants';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer';
import { BaseDeserializer } from '../../base-deserializer';
import { ValueDeserializer } from '../../misc/value-deserializer';
import { CssCompoundSelectorDeserializer } from './css-compound-selector-deserializer';

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let frequentCssCombinatorsDeserializationMap: Map<number, string>;
const getFrequentCssCombinatorsDeserializationMap = () => {
    if (!frequentCssCombinatorsDeserializationMap) {
        frequentCssCombinatorsDeserializationMap = new Map<number, string>(
            Array.from(FREQUENT_CSS_COMBINATORS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }

    return frequentCssCombinatorsDeserializationMap;
};

/**
 * Deserializes binary data into CSS complex selector item nodes.
 */
export class CssComplexSelectorItemDeserializer extends BaseDeserializer {
    /**
     * Deserializes a CSS complex selector item node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @param frequentAttributes An optional map of frequently used attribute name indexes,
     * along with their corresponding serialization name strings.
     * @param frequentPseudoClasses An optional map of frequently used pseudo-class name indexes,
     * along with their corresponding serialization name strings.
     *
     * @throws If the binary data is malformed.
     */
    public static deserialize(
        buffer: InputByteBuffer,
        node: Partial<CssComplexSelectorItem>,
        frequentAttributes?: Map<number, string>,
        frequentPseudoClasses?: Map<number, string>,
    ): void {
        // assert header
        buffer.assertUint8(CssSelectorMarshallingMap.ComplexSelectorItemHeader);
        node.type = 'CssComplexSelectorItem';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case CssSelectorMarshallingMap.ComplexSelectorItemCombinator:
                    ValueDeserializer.deserialize(
                        buffer,
                        node.combinator = {} as Value<CssSelectorCombinator>,
                        getFrequentCssCombinatorsDeserializationMap(),
                    );
                    break;

                case CssSelectorMarshallingMap.ComplexSelectorItemSelector:
                    CssCompoundSelectorDeserializer.deserialize(
                        buffer,
                        node.selector = {} as CssCompoundSelector,
                        frequentAttributes,
                        frequentPseudoClasses,
                    );
                    break;

                case CssSelectorMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case CssSelectorMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid CSS complex selector item property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
