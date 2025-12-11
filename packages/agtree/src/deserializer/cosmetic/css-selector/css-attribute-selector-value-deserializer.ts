/* eslint-disable no-param-reassign */
import {
    CssSelectorMarshallingMap,
    FREQUENT_CSS_ATTRIBUTE_OPERATORS_SERIALIZATION_MAP,
} from '../../../marshalling-utils/cosmetic/css-selector-common';
import { type Value, type CssAttributeSelectorValue, type CssAttributeSelectorOperator } from '../../../nodes';
import { NULL } from '../../../utils/constants';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer';
import { BaseDeserializer } from '../../base-deserializer';
import { ValueDeserializer } from '../../misc/value-deserializer';

/**
 * Value map for binary deserialization. This helps to reduce the size of the serialized data,
 * as it allows us to use a single byte to represent frequently used values.
 */
let frequentCssAttributeOperatorsDeserializationMap: Map<number, string>;
const getFrequentCssAttributeOperatorsDeserializationMap = () => {
    if (!frequentCssAttributeOperatorsDeserializationMap) {
        frequentCssAttributeOperatorsDeserializationMap = new Map<number, string>(
            Array.from(FREQUENT_CSS_ATTRIBUTE_OPERATORS_SERIALIZATION_MAP).map(([key, value]) => [value, key]),
        );
    }

    return frequentCssAttributeOperatorsDeserializationMap;
};

/**
 * Deserializes binary data into CSS attribute selector value nodes.
 */
export class CssAttributeSelectorValueDeserializer extends BaseDeserializer {
    /**
     * Deserializes a CSS attribute selector value node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     *
     * @throws If the binary data is malformed.
     */
    public static deserialize(
        buffer: InputByteBuffer,
        node: Partial<CssAttributeSelectorValue>,
    ): void {
        // assert header
        buffer.assertUint8(CssSelectorMarshallingMap.AttributeSelectorValueHeader);
        node.type = 'CssAttributeSelectorValue';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case CssSelectorMarshallingMap.AttributeSelectorValueValue:
                    ValueDeserializer.deserialize(
                        buffer,
                        node.value = {} as Value,
                    );
                    break;

                case CssSelectorMarshallingMap.AttributeSelectorValueOperator:
                    ValueDeserializer.deserialize(
                        buffer,
                        node.operator = {} as Value<CssAttributeSelectorOperator>,
                        getFrequentCssAttributeOperatorsDeserializationMap(),
                    );
                    break;

                case CssSelectorMarshallingMap.AttributeSelectorValueIsCaseSensitive:
                    node.isCaseSensitive = buffer.readUint8() !== 0;
                    break;

                case CssSelectorMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case CssSelectorMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid CSS attribute selector value property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
