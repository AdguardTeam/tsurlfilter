/* eslint-disable no-param-reassign */
import { CssSelectorMarshallingMap } from '../../../marshalling-utils/cosmetic/css-selector-common';
import { type CssComplexSelectorItem, type CssComplexSelector } from '../../../nodes';
import { NULL } from '../../../utils/constants';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer';
import { BaseDeserializer } from '../../base-deserializer';
import { CssComplexSelectorItemDeserializer } from './css-complex-selector-item-deserializer';

/**
 * Deserializes binary data into CSS complex selector nodes.
 */
export class CssComplexSelectorDeserializer extends BaseDeserializer {
    /**
     * Deserializes a CSS complex selector node from binary format.
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
        node: Partial<CssComplexSelector>,
        frequentAttributes?: Map<number, string>,
        frequentPseudoClasses?: Map<number, string>,
    ): void {
        // assert header
        buffer.assertUint8(CssSelectorMarshallingMap.ComplexSelectorHeader);
        node.type = 'CssComplexSelector';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case CssSelectorMarshallingMap.ComplexSelectorChildren:
                    node.children = new Array(buffer.readUint8());
                    for (let i = 0; i < node.children.length; i += 1) {
                        CssComplexSelectorItemDeserializer.deserialize(
                            buffer,
                            node.children[i] = {} as CssComplexSelectorItem,
                            frequentAttributes,
                            frequentPseudoClasses,
                        );
                    }
                    break;

                case CssSelectorMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case CssSelectorMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid CSS complex selector property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
