import { CssSelectorMarshallingMap } from '../../../marshalling-utils/cosmetic/css-selector-common';
import { type CssSimpleSelector } from '../../../nodes';
import { type OutputByteBuffer } from '../../../utils';
import { NULL } from '../../../utils/constants';
import { BaseSerializer } from '../../base-serializer';
import { ValueSerializer } from '../../misc/value-serializer';
import { CssAttributeSelectorSerializer } from './css-attribute-selector-serializer';
import { CssPseudoClassSelectorSerializer } from './css-pseudo-class-selector-serializer';

/**
 * Serializer for CSS simple selector nodes.
 */
export class CssSimpleSelectorSerializer extends BaseSerializer {
    /**
     * Serializes a CSS simple selector node into a compact binary format.
     *
     * @param node The CssSimpleSelector node to serialize.
     * @param buffer The OutputByteBuffer used for writing the binary data.
     * @param frequentAttributes An optional map of frequently used attribute names,
     * along with their corresponding serialization index.
     * @param frequentPseudoClasses An optional map of frequently used pseudo-class names,
     * along with their corresponding serialization index.
     *
     * @throws Error if unable to serialize.
     */
    public static serialize(
        node: CssSimpleSelector,
        buffer: OutputByteBuffer,
        frequentAttributes?: Map<string, number>,
        frequentPseudoClasses?: Map<string, number>,
    ): void {
        // write header
        buffer.writeUint8(CssSelectorMarshallingMap.SimpleSelectorHeader);

        // write simple selector depending on its type
        const { type } = node;
        switch (type) {
            // write value
            case 'Value':
                buffer.writeUint8(CssSelectorMarshallingMap.SimpleSelectorValue);
                ValueSerializer.serialize(node, buffer);
                break;

            // write attribute selector
            case 'CssAttributeSelector':
                buffer.writeUint8(CssSelectorMarshallingMap.SimpleSelectorAttribute);
                CssAttributeSelectorSerializer.serialize(node, buffer, frequentAttributes);
                break;

            // write pseudo-class selector
            case 'CssPseudoClassSelector':
                buffer.writeUint8(CssSelectorMarshallingMap.SimpleSelectorPseudoClass);
                CssPseudoClassSelectorSerializer.serialize(node, buffer, frequentPseudoClasses);
                break;

            default:
                throw new Error(`Unknown simple selector type: ${type}`);
        }

        // write null terminator
        buffer.writeUint8(NULL);
    }
}
