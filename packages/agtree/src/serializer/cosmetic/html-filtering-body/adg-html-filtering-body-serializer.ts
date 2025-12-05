import { type HtmlFilteringRuleBody } from '../../../nodes';
import { type OutputByteBuffer } from '../../../utils/output-byte-buffer';
import { BaseSerializer } from '../../base-serializer';
import { HtmlFilteringBodySerializer } from './html-filtering-body-serializer';
import {
    FREQUENT_ADG_HTML_FILTERING_ATTRIBUTE_SERIALIZATION_MAP,
    FREQUENT_ADG_HTML_FILTERING_PSEUDO_CLASS_SERIALIZATION_MAP,
} from '../../../marshalling-utils/cosmetic/body/adg-html-filtering-body-common';

/**
 * `AdgHtmlFilteringBodySerializer` is responsible for serializing the body of an AdGuard-style HTML filtering rule.
 *
 * Please note that the serializer will serialize any HTML filtering rule if it is syntactically correct.
 * For example, it will serialize this:
 * ```adblock
 * example.com$$div[special-attr="value"]
 * ```
 *
 * but it didn't check if the attribute `special-attr` actually supported by any adblocker.
 *
 * @see {@link https://adguard.com/kb/general/ad-filtering/create-own-filters/#html-filtering-rules}
 */
export class AdgHtmlFilteringBodySerializer extends BaseSerializer {
    /**
     * Serializes a HTML filtering rule body node to binary format.
     *
     * @param node Node to serialize.
     * @param buffer ByteBuffer for writing binary data.
     */
    public static serialize(node: HtmlFilteringRuleBody, buffer: OutputByteBuffer): void {
        HtmlFilteringBodySerializer.serialize(
            node,
            buffer,
            FREQUENT_ADG_HTML_FILTERING_ATTRIBUTE_SERIALIZATION_MAP,
            FREQUENT_ADG_HTML_FILTERING_PSEUDO_CLASS_SERIALIZATION_MAP,
        );
    }
}
