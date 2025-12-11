import { type HtmlFilteringRuleBody } from '../../../nodes';
import { type OutputByteBuffer } from '../../../utils/output-byte-buffer';
import { NULL } from '../../../utils/constants';
import { isUndefined } from '../../../utils/type-guards';
import { BaseSerializer } from '../../base-serializer';
import { BinaryTypeMarshallingMap } from '../../../marshalling-utils/misc/binary-type-common';
import { HtmlFilteringBodyMarshallingMap } from '../../../marshalling-utils/cosmetic/body/html-filtering-body-common';
import { CssSelectorListSerializer } from '../css-selector/css-selector-list-serializer';

/**
 * Serializer for HTML filtering rule body nodes.
 */
export class HtmlFilteringBodySerializer extends BaseSerializer {
    /**
     * Serializes a HTML filtering rule body node into a compact binary format.
     *
     * @param node The HtmlFilteringRuleBody node to serialize.
     * @param buffer The OutputByteBuffer used for writing the binary data.
     * @param frequentAttributes An optional map of frequently used attribute names,
     * along with their corresponding serialization index.
     * @param frequentPseudoClasses An optional map of frequently used pseudo-class names,
     * along with their corresponding serialization index.
     *
     * @note We write lengths of arrays, because it helps to optimize the deserialization process.
     */
    public static serialize(
        node: HtmlFilteringRuleBody,
        buffer: OutputByteBuffer,
        frequentAttributes?: Map<string, number>,
        frequentPseudoClasses?: Map<string, number>,
    ): void {
        // write node type
        buffer.writeUint8(BinaryTypeMarshallingMap.HtmlFilteringRuleBody);

        // write selector list
        buffer.writeUint8(HtmlFilteringBodyMarshallingMap.SelectorList);
        CssSelectorListSerializer.serialize(
            node.selectorList,
            buffer,
            frequentAttributes,
            frequentPseudoClasses,
        );

        // write body start position
        if (!isUndefined(node.start)) {
            buffer.writeUint8(HtmlFilteringBodyMarshallingMap.Start);
            buffer.writeUint32(node.start);
        }

        // write body end position
        if (!isUndefined(node.end)) {
            buffer.writeUint8(HtmlFilteringBodyMarshallingMap.End);
            buffer.writeUint32(node.end);
        }

        // write null terminator
        buffer.writeUint8(NULL);
    }
}
