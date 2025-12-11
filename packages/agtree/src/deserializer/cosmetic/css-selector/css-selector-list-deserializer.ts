/* eslint-disable no-param-reassign */
import { CssSelectorMarshallingMap } from '../../../marshalling-utils/cosmetic/css-selector-common';
import { type CssComplexSelector, type CssSelectorList } from '../../../nodes';
import { NULL } from '../../../utils/constants';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer';
import { BaseDeserializer } from '../../base-deserializer';
import { CssComplexSelectorDeserializer } from './css-complex-selector-deserializer';

/**
 * Deserializes binary data into CSS selector list nodes.
 */
export class CssSelectorListDeserializer extends BaseDeserializer {
    /**
     * Deserializes a CSS selector list node from binary format.
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
        node: Partial<CssSelectorList>,
        frequentAttributes?: Map<number, string>,
        frequentPseudoClasses?: Map<number, string>,
    ): void {
        // assert header
        buffer.assertUint8(CssSelectorMarshallingMap.SelectorListHeader);
        node.type = 'CssSelectorList';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case CssSelectorMarshallingMap.SelectorListChildren:
                    node.children = new Array(buffer.readUint8());
                    for (let i = 0; i < node.children.length; i += 1) {
                        CssComplexSelectorDeserializer.deserialize(
                            buffer,
                            node.children[i] = {} as CssComplexSelector,
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
                    throw new Error(`Invalid CSS selector list property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
