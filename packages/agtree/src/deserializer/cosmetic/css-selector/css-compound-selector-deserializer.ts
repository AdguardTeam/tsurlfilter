/* eslint-disable no-param-reassign */
import { CssSelectorMarshallingMap } from '../../../marshalling-utils/cosmetic/css-selector-common';
import { type CssSimpleSelector, type CssCompoundSelector } from '../../../nodes';
import { NULL } from '../../../utils/constants';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer';
import { BaseDeserializer } from '../../base-deserializer';
import { CssSimpleSelectorDeserializer } from './css-simple-selector-deserializer';

/**
 * Deserializes binary data into CSS compound selector nodes.
 */
export class CssCompoundSelectorDeserializer extends BaseDeserializer {
    /**
     * Deserializes a CSS compound selector node from binary format.
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
        node: Partial<CssCompoundSelector>,
        frequentAttributes?: Map<number, string>,
        frequentPseudoClasses?: Map<number, string>,
    ): void {
        // assert header
        buffer.assertUint8(CssSelectorMarshallingMap.CompoundSelectorHeader);
        node.type = 'CssCompoundSelector';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case CssSelectorMarshallingMap.CompoundSelectorChildren:
                    node.children = new Array(buffer.readUint8());
                    for (let i = 0; i < node.children.length; i += 1) {
                        CssSimpleSelectorDeserializer.deserialize(
                            buffer,
                            node.children[i] = {} as CssSimpleSelector,
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
                    throw new Error(`Invalid CSS compound selector property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
