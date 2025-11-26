import { type HtmlFilteringRuleBody } from '../../../nodes';
import { type OutputByteBuffer } from '../../../utils/output-byte-buffer';
import { BaseSerializer } from '../../base-serializer';
import { HtmlFilteringBodySerializer } from './html-filtering-body-serializer';
import {
    FREQUENT_UBO_HTML_FILTERING_PSEUDO_CLASS_SERIALIZATION_MAP,
} from '../../../marshalling-utils/cosmetic/body/ubo-html-filtering-body-common';

/**
 * `UboHtmlFilteringBodySerializer` is responsible for serializing the body of
 * an uBlock-style HTML filtering rule, and also uBlock-style response header removal rule.
 *
 * Please note that the serializer will serialize any HTML filtering rule if it is syntactically correct.
 * For example, it will serialize this:
 * ```adblock
 * example.com##^script:pseudo(content)
 * example.com##^responseheader(header-name)
 * ```
 *
 * but it didn't check if the pseudo selector `pseudo` or if
 * the header name `header-name` actually supported by any adblocker.
 *
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#html-filters}
 * @see {@link https://github.com/gorhill/uBlock/wiki/Static-filter-syntax#response-header-filtering}
 */
export class UboHtmlFilteringBodySerializer extends BaseSerializer {
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
            undefined,
            FREQUENT_UBO_HTML_FILTERING_PSEUDO_CLASS_SERIALIZATION_MAP,
        );
    }
}
