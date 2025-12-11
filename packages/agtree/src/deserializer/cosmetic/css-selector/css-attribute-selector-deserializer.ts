/* eslint-disable no-param-reassign */
import { CssSelectorMarshallingMap } from '../../../marshalling-utils/cosmetic/css-selector-common';
import { type CssAttributeSelectorValue, type CssAttributeSelector, type Value } from '../../../nodes';
import { NULL } from '../../../utils/constants';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer';
import { BaseDeserializer } from '../../base-deserializer';
import { ValueDeserializer } from '../../misc/value-deserializer';
import { CssAttributeSelectorValueDeserializer } from './css-attribute-selector-value-deserializer';

/**
 * Deserializes binary data into CSS attribute selector nodes.
 */
export class CssAttributeSelectorDeserializer extends BaseDeserializer {
    /**
     * Deserializes a CSS attribute selector node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @param frequentAttributes An optional map of frequently used attribute name indexes,
     * along with their corresponding serialization name strings.
     *
     * @throws If the binary data is malformed.
     */
    public static deserialize(
        buffer: InputByteBuffer,
        node: Partial<CssAttributeSelector>,
        frequentAttributes?: Map<number, string>,
    ): void {
        // assert header
        buffer.assertUint8(CssSelectorMarshallingMap.AttributeSelectorHeader);
        node.type = 'CssAttributeSelector';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case CssSelectorMarshallingMap.AttributeSelectorName:
                    ValueDeserializer.deserialize(
                        buffer,
                        node.name = {} as Value,
                        frequentAttributes,
                    );
                    break;

                case CssSelectorMarshallingMap.AttributeSelectorValue:
                    CssAttributeSelectorValueDeserializer.deserialize(
                        buffer,
                        node.value = {} as CssAttributeSelectorValue,
                    );
                    break;

                case CssSelectorMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case CssSelectorMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid CSS attribute selector property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
