/* eslint-disable no-param-reassign */
import { CssSelectorMarshallingMap } from '../../../marshalling-utils/cosmetic/css-selector-common';
import { type Value, type CssPseudoClassSelector } from '../../../nodes';
import { NULL } from '../../../utils/constants';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer';
import { BaseDeserializer } from '../../base-deserializer';
import { ValueDeserializer } from '../../misc/value-deserializer';

/**
 * Deserializes binary data into CSS pseudo-class selector nodes.
 */
export class CssPseudoClassSelectorDeserializer extends BaseDeserializer {
    /**
     * Deserializes a CSS pseudo-class selector node from binary format.
     *
     * @param buffer ByteBuffer for reading binary data.
     * @param node Destination node.
     * @param frequentPseudoClasses An optional map of frequently used pseudo-class name indexes,
     * along with their corresponding serialization name strings.
     *
     * @throws If the binary data is malformed.
     */
    public static deserialize(
        buffer: InputByteBuffer,
        node: Partial<CssPseudoClassSelector>,
        frequentPseudoClasses?: Map<number, string>,
    ): void {
        // assert header
        buffer.assertUint8(CssSelectorMarshallingMap.PseudoClassSelectorHeader);
        node.type = 'CssPseudoClassSelector';

        let prop = buffer.readUint8();
        while (prop !== NULL) {
            switch (prop) {
                case CssSelectorMarshallingMap.PseudoClassSelectorName:
                    ValueDeserializer.deserialize(
                        buffer,
                        node.name = {} as Value,
                        frequentPseudoClasses,
                    );
                    break;

                case CssSelectorMarshallingMap.PseudoClassSelectorArgument:
                    ValueDeserializer.deserialize(
                        buffer,
                        node.argument = {} as Value,
                    );
                    break;

                case CssSelectorMarshallingMap.Start:
                    node.start = buffer.readUint32();
                    break;

                case CssSelectorMarshallingMap.End:
                    node.end = buffer.readUint32();
                    break;

                default:
                    throw new Error(`Invalid CSS pseudo-class selector property: ${prop}`);
            }

            prop = buffer.readUint8();
        }
    }
}
