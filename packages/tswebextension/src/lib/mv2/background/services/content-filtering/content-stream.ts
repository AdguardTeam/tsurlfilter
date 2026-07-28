import { type WebRequest } from 'webextension-polyfill';

import TextEncoding from '@adguard/text-encoding';
import { RequestType } from '@adguard/tsurlfilter';

import { FilteringEventType, type FilteringLogInterface } from '../../../../common/filtering-log';
import { logger } from '../../../../common/utils/logger';
import { type RequestContext } from '../../request';

import {
    DEFAULT_CHARSET,
    LATIN_1,
    parseCharsetFromCss,
    parseCharsetFromHeader,
    parseCharsetFromHtml,
    SUPPORTED_CHARSETS,
    WIN_1252,
} from './charsets';
import { type ContentStringFilterInterface } from './content-string-filter';

/**
 * Maximum total response size (in bytes) for which we perform content
 * filtering. Responses larger than this are passed through unmodified.
 *
 * Buffering arbitrarily large responses leads to excessive memory consumption
 * and GC pressure in the extension process, since the whole response has to
 * be held in memory until the request finishes.
 *
 * This limit also protects against never-ending responses (e.g. Server-Sent
 * Events or other long-lived streaming endpoints): their `onstop` event may
 * never fire, so without the limit we would buffer and decode such streams
 * indefinitely while the page receives no data at all. Once the limit is
 * crossed, all buffered bytes are flushed to the page and the filter
 * disconnects, letting the stream flow directly to the page.
 *
 * The value is aligned with the 10 MB response size limit for `$replace`
 * rules in `ContentStringFilter.applyRules`.
 *
 * Original issue link: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3525.
 */
const MAX_CONTENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Unicode replacement character (U+FFFD) that appears when the decoder
 * encounters bytes that cannot be decoded using the current charset.
 * Its presence indicates that either the charset was incorrectly determined
 * or the original content contains invalid byte sequences for the specified
 * encoding.
 */
const REPLACEMENT_CHAR = '\uFFFD';

/**
 * Content Stream Filter class.
 *
 * Encapsulates response data stream filtering logic
 * https://mail.mozilla.org/pipermail/dev-addons/2017-April/002729.html.
 *
 * Performance note: decoding is done with the platform-native `TextDecoder`,
 * which supports all charsets from {@link SUPPORTED_CHARSETS}. The pure-JS
 * polyfill from `@adguard/text-encoding` decodes responses byte-by-byte and
 * produces an enormous amount of short-lived allocations (it was a source of
 * constant `OUT_OF_NURSERY` minor GCs and high memory usage in Firefox).
 * The polyfill is only used for encoding back to legacy charsets, which the
 * native `TextEncoder` does not support, and which happens at most once per
 * request.
 */
export class ContentStream {
    /**
     * Request context.
     *
     * This object is mutated during request processing.
     */
    private context: RequestContext;

    /**
     * Content filter.
     *
     * Modifies content with specified rules.
     */
    private contentStringFilter: ContentStringFilterInterface;

    /**
     * Web request filter.
     */
    private filter: WebRequest.StreamFilter;

    /**
     * Request charset.
     */
    private charset: string | undefined;

    /**
     * Content.
     */
    private content: string;

    /**
     * Decoder instance.
     *
     * Native `TextDecoder` is used for performance reasons, see class JSDoc.
     */
    private decoder: TextDecoder | undefined;

    /**
     * Encoder instance.
     *
     * Native `TextEncoder` for utf-8, polyfill encoder for legacy charsets.
     */
    private encoder: TextEncoder | TextEncoding.TextEncoder | undefined;

    /**
     * Filtering log.
     */
    private readonly filteringLog: FilteringLogInterface;

    /**
     * Buffer for raw response data chunks.
     *
     * Kept until the response finishes so that the original bytes can be
     * written back unmodified if decoding fails or filtering is aborted.
     * Total buffered size is bounded by {@link MAX_CONTENT_SIZE_BYTES}.
     */
    private rawChunks: ArrayBuffer[] = [];

    /**
     * Total size (in bytes) of raw chunks received so far.
     * Used to enforce {@link MAX_CONTENT_SIZE_BYTES} and disconnect early
     * for large responses.
     */
    private totalRawSize = 0;

    /**
     * Contains collection of accepted content types for stream filtering.
     */
    private readonly allowedContentTypes = [
        'text/',
        'application/json',
        'application/xml',
        'application/xhtml+xml',
        'application/javascript',
        'application/x-javascript',
    ];

    /**
     * Content stream constructor.
     *
     * @param context Request context.
     * @param contentStringFilter Content filter.
     * @param streamFilterCreator Stream filter creator.
     * @param filteringLog Filtering log.
     */
    constructor(
        context: RequestContext,
        contentStringFilter: ContentStringFilterInterface,
        streamFilterCreator: (id: string) => WebRequest.StreamFilter,
        filteringLog: FilteringLogInterface,
    ) {
        this.content = '';
        this.context = context;
        this.contentStringFilter = contentStringFilter;

        this.filteringLog = filteringLog;
        this.filter = streamFilterCreator(context.requestId);

        this.onResponseData = this.onResponseData.bind(this);
        this.onResponseFinish = this.onResponseFinish.bind(this);
        this.onResponseError = this.onResponseError.bind(this);
    }

    /**
     * Initializes encoders and filter.
     */
    public init(): void {
        this.initEncoders();
        this.initFilter();
    }

    /**
     * Writes data to stream.
     *
     * @param content Content to write.
     */
    public write(content: string): void {
        this.filter.write(this.encoder!.encode(content));
        this.filter.close();
    }

    /**
     * Sets charset.
     *
     * @param charset Charset.
     */
    public setCharset(charset: string | null): void {
        if (charset) {
            this.charset = charset;
            this.initEncoders();
        }
    }

    /**
     * Initializes encoders.
     */
    private initEncoders(): void {
        let set = this.charset ? this.charset : DEFAULT_CHARSET;

        // Redefining it as TextDecoder does not understand the iso- name
        if (set === LATIN_1) {
            set = WIN_1252;
        }

        this.decoder = new TextDecoder(set);
        if (set === DEFAULT_CHARSET) {
            this.encoder = new TextEncoder();
        } else {
            // Only the polyfill supports encoding to legacy charsets.
            // It is slow, but it is used at most once per request.
            this.encoder = new TextEncoding.TextEncoder(set, { NONSTANDARD_allowLegacyEncoding: true });
        }
    }

    /**
     * Initializes filter.
     */
    private initFilter(): void {
        this.filter.ondata = this.onResponseData;
        this.filter.onstop = this.onResponseFinish;
        this.filter.onerror = this.onResponseError;
    }

    /**
     * We do not support stream filtering for some content types.
     *
     * @returns True if content type is supported.
     */
    private shouldProcessFiltering(): boolean {
        const { requestType, contentTypeHeader } = this.context;
        if (requestType === RequestType.Other || requestType === RequestType.XmlHttpRequest) {
            return !!contentTypeHeader && this.allowedContentTypes.some((contentType) => {
                return contentTypeHeader.indexOf(contentType) === 0;
            });
        }

        return true;
    }

    /**
     * Handler for response data.
     *
     * @param event Stream filter event.
     */
    private onResponseData(event: WebRequest.StreamFilterEventData): void {
        const { data } = event;

        // Always buffer raw chunks: they are needed for a byte-exact fallback
        // when decoding fails, and to flush already received bytes if
        // filtering is aborted mid-stream. Total size is bounded by MAX_CONTENT_SIZE_BYTES.
        this.rawChunks.push(data);
        this.totalRawSize += data.byteLength;

        if (this.totalRawSize > MAX_CONTENT_SIZE_BYTES) {
            logger.debug(`[tsweb.ContentStream.onResponseData]: disconnecting request ${this.context.requestId} because response size exceeded the limit of ${MAX_CONTENT_SIZE_BYTES} bytes`);
            this.flushRawAndDisconnect();
            return;
        }

        if (!this.shouldProcessFiltering()) {
            this.flushRawAndDisconnect();
            return;
        }

        if (!this.charset) {
            try {
                let charset;
                /**
                 * If this.charset is undefined and requestType is Document or Subdocument, we try to detect charset
                 * from page <meta> tags.
                 */
                if (this.context.requestType === RequestType.SubDocument
                    || this.context.requestType === RequestType.Document) {
                    charset = ContentStream.parseHtmlCharset(data);
                }

                /**
                 * If this.charset is undefined and requestType is Stylesheet, we try to detect charset from css
                 * directive.
                 */
                if (this.context.requestType === RequestType.Stylesheet) {
                    charset = ContentStream.parseCssCharset(data);
                }

                // If charset is not detected, try to parse it from Content-Type header if it exists
                if (!charset && this.context.contentTypeHeader) {
                    charset = parseCharsetFromHeader(this.context.contentTypeHeader);
                }

                if (!charset) {
                    charset = DEFAULT_CHARSET;
                }

                if (charset && SUPPORTED_CHARSETS.includes(charset)) {
                    this.charset = charset;
                    this.initEncoders();
                    this.content += this.decoder!.decode(data, { stream: true });
                } else {
                    // Charset is not supported
                    this.flushRawAndDisconnect();
                }
            } catch (e) {
                logger.warn('[tsweb.ContentStream.onResponseData]: Error during charset detection/initial decode. Disconnecting.', e);
                this.flushRawAndDisconnect();
            }
        } else {
            try {
                this.content += this.decoder!.decode(data, { stream: true });
            } catch (decodingError) {
                logger.warn('[tsweb.ContentStream.onResponseData]: Error decoding subsequent chunk with charset. Disconnecting.', decodingError);
                this.flushRawAndDisconnect();
            }
        }
    }

    /**
     * Handler for response error.
     */
    private onResponseError(): void {
        if (this.filter.error) {
            logger.info('[tsweb.ContentStream.onResponseError]: catched error: ', this.filter.error);
        }
    }

    /**
     * Handler for the end of response data.
     */
    private onResponseFinish(): void {
        if (!this.decoder) {
            this.flushRawAndDisconnect();
            return;
        }

        this.content += this.decoder.decode(); // finish stream

        // For non-200 responses there is no point in applying content
        // filtering.  Flush the original raw bytes to avoid any risk of
        // the decode→re-encode round-trip altering the payload (the
        // polyfill encoder for legacy charsets is non-identical to the
        // server's original encoding).
        const { contentTypeHeader, statusCode } = this.context;

        if (statusCode !== 200) {
            this.flushRawAndDisconnect();
            return;
        }

        this.filteringLog.publishEvent({
            type: FilteringEventType.ContentFilteringStart,
            data: {
                requestId: this.context.requestId,
            },
        });

        const charset = parseCharsetFromHeader(contentTypeHeader);

        if (charset) {
            if (!SUPPORTED_CHARSETS.includes(charset)) {
                // Charset is detected and it is not supported
                logger.warn(`[tsweb.ContentStream.onResponseFinish]: skipping request ${this.context.requestId} with Content-Type ${this.context.contentTypeHeader}`);
                this.writeAndCleanup(this.content);
                return;
            }
            this.setCharset(charset);
        }

        // Presence of the replacement character indicates the original byte
        // stream was likely invalid for the determined charset. In this case,
        // we write the buffered raw chunks back unmodified to avoid corrupting
        // the response.
        if (this.content.includes(REPLACEMENT_CHAR)) {
            logger.debug(`[tsweb.ContentStream.onResponseFinish]: writing raw chunks for request ${this.context.requestId}`);
            for (const chunk of this.rawChunks) {
                this.filter.write(chunk);
            }
            this.filter.close();
            this.cleanup();
            return;
        }

        const filteredContent = this.contentStringFilter.applyRules(this.content);

        this.writeAndCleanup(filteredContent);

        this.filteringLog.publishEvent({
            type: FilteringEventType.ContentFilteringFinish,
            data: {
                requestId: this.context.requestId,
            },
        });
    }

    /**
     * Writes content to the stream, closes it and releases buffers.
     *
     * @param content Content to write.
     */
    private writeAndCleanup(content: string): void {
        this.write(content);
        this.cleanup();
    }

    /**
     * Flushes all buffered raw chunks to the stream and disconnects the
     * filter, so the page receives its content unmodified and all further
     * data bypasses the extension entirely.
     */
    private flushRawAndDisconnect(): void {
        for (const chunk of this.rawChunks) {
            this.filter.write(chunk);
        }
        this.filter.disconnect();
        this.cleanup();
    }

    /**
     * Releases all buffered data.
     */
    private cleanup(): void {
        this.rawChunks = [];
        this.content = '';
        this.totalRawSize = 0;
    }

    /**
     * Parses charset from html.
     *
     * @param data Data to parse.
     *
     * @returns Parsed charset or null.
     */
    private static parseHtmlCharset(data: BufferSource): string | null {
        const decoded = new TextDecoder('utf-8').decode(data).toLowerCase();
        return parseCharsetFromHtml(decoded);
    }

    /**
     * Parses charset from css.
     *
     * @param data Data to parse.
     *
     * @returns Parsed charset or null.
     */
    private static parseCssCharset(data: BufferSource): string | null {
        const decoded = new TextDecoder('utf-8').decode(data).toLowerCase();
        return parseCharsetFromCss(decoded);
    }
}
