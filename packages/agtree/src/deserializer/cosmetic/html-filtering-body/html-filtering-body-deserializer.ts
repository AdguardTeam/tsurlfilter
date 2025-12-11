/* eslint-disable no-param-reassign */
import { type CssSelectorList, type HtmlFilteringRuleBody } from '../../../nodes';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer';
import { NULL } from '../../../utils/constants';
import { BaseDeserializer } from '../../base-deserializer';
import { BinaryTypeMarshallingMap } from '../../../marshalling-utils/misc/binary-type-common';
import { HtmlFilteringBodyMarshallingMap } from '../../../marshalling-utils/cosmetic/body/html-filtering-body-common';
import { CssSelectorListDeserializer } from '../css-selector/css-selector-list-deserializer';

/**
 * Deserializes binary data into HTML filtering rule body nodes.
 * Optionally uses a map of frequently used attribute names or pseudo-class names.
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
                    CssSelectorListDeserializer.deserialize(
                        buffer,
                        node.selectorList = {} as CssSelectorList,
                        frequentAttributes,
                        frequentPseudoClasses,
                    );
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
}
