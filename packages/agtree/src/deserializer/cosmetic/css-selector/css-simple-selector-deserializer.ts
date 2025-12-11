/* eslint-disable no-param-reassign */
import { CssSelectorMarshallingMap } from '../../../marshalling-utils/cosmetic/css-selector-common';
import {
    type Value,
    type CssSimpleSelector,
    type CssAttributeSelector,
    type CssPseudoClassSelector,
} from '../../../nodes';
import { NULL } from '../../../utils/constants';
import { type InputByteBuffer } from '../../../utils/input-byte-buffer';
import { BaseDeserializer } from '../../base-deserializer';
import { ValueDeserializer } from '../../misc/value-deserializer';
import { CssAttributeSelectorDeserializer } from './css-attribute-selector-deserializer';
import { CssPseudoClassSelectorDeserializer } from './css-pseudo-class-selector-deserializer';

/**
 * Deserializes binary data into CSS simple selector nodes.
 */
export class CssSimpleSelectorDeserializer extends BaseDeserializer {
    /**
     * Deserializes a CSS simple selector node from binary format.
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
        node: Partial<CssSimpleSelector>,
        frequentAttributes?: Map<number, string>,
        frequentPseudoClasses?: Map<number, string>,
    ): void {
        // assert header
        buffer.assertUint8(CssSelectorMarshallingMap.SimpleSelectorHeader);

        const prop = buffer.readUint8();
        switch (prop) {
            case CssSelectorMarshallingMap.SimpleSelectorValue:
                ValueDeserializer.deserialize(
                    buffer,
                    node as Value,
                );
                break;

            case CssSelectorMarshallingMap.SimpleSelectorAttribute:
                CssAttributeSelectorDeserializer.deserialize(
                    buffer,
                    node as CssAttributeSelector,
                    frequentAttributes,
                );
                break;

            case CssSelectorMarshallingMap.SimpleSelectorPseudoClass:
                CssPseudoClassSelectorDeserializer.deserialize(
                    buffer,
                    node as CssPseudoClassSelector,
                    frequentPseudoClasses,
                );
                break;

            default:
                throw new Error(`Invalid CSS simple selector item property: ${prop}`);
        }

        buffer.assertUint8(NULL);
    }
}
