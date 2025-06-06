import TextEncoding from '@adguard/text-encoding';
import { type WebRequest } from 'webextension-polyfill';
import { RequestType } from '@adguard/tsurlfilter';

import { type RequestContext } from '../../request';
import { FilteringEventType, type FilteringLogInterface } from '../../../../common/filtering-log';
import { logger } from '../../../../common/utils/logger';

import { type ContentStringFilterInterface } from './content-string-filter';
import {
    DEFAULT_CHARSET,
    LATIN_1,
    SUPPORTED_CHARSETS,
    WIN_1252,
    parseCharsetFromHtml,
    parseCharsetFromCss,
    parseCharsetFromHeader,
} from './charsets';

// Do not destruct inside import, because it somehow breaks build in browser
// extension via "ReferenceError: TextDecoder is not defined".
const { TextEncoder, TextDecoder } = TextEncoding;

/**
 * Content Stream Filter class.
 *
 * Encapsulates response data stream filtering logic
 * https://mail.mozilla.org/pipermail/dev-addons/2017-April/002729.html.
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
     */
    private decoder: TextEncoding.TextDecoder | undefined;

    /**
     * Encoder instance.
     */
    private encoder: TextEncoding.TextEncoder | undefined;

    /**
     * Filtering log.
     */
    private readonly filteringLog: FilteringLogInterface;

    /**
     * Buffer for raw response data chunks.
     */
    private rawChunks: ArrayBuffer[] = [];

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
     * Disconnects filter from stream.
     *
     * @param data Data to write.
     */
    public disconnect(data: BufferSource): void {
        this.filter.write(data as ArrayBuffer);
        this.filter.disconnect();

        // Clear buffers when explicitly disconnecting
        this.rawChunks = [];
        this.content = '';
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
            this.encoder = new TextEncoder(set, { NONSTANDARD_allowLegacyEncoding: true });
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
        // Store raw data regardless of decoding outcome for potential fallback
        this.rawChunks.push(event.data);

        if (!this.shouldProcessFiltering()) {
            this.disconnect(event.data);
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
                    charset = ContentStream.parseHtmlCharset(event.data);
                }

                /**
                 * If this.charset is undefined and requestType is Stylesheet, we try to detect charset from css
                 * directive.
                 */
                if (this.context.requestType === RequestType.Stylesheet) {
                    charset = ContentStream.parseCssCharset(event.data);
                }

                // If charset is not detected, try to parse it from Content-Type header if it exists
                if (!charset && this.context.contentTypeHeader) {
                    charset = parseCharsetFromHeader(this.context.contentTypeHeader);
                }

                if (!charset) {
                    charset = DEFAULT_CHARSET;
                }

                if (charset && SUPPORTED_CHARSETS.indexOf(charset) >= 0) {
                    this.charset = charset;
                    this.initEncoders();
                    this.content += this.decoder!.decode(event.data, { stream: true });
                } else {
                    // Charset is not supported
                    this.disconnect(event.data);
                }
            } catch (e) {
                logger.warn('[tsweb.ContentStream.onResponseData]: Error during charset detection/initial decode. Disconnecting.', e);
                this.disconnect(event.data);
            }
        } else {
            try {
                const decodedChunk = this.decoder!.decode(event.data, { stream: true });
                this.content += decodedChunk;
            } catch (decodingError) {
                logger.warn('[tsweb.ContentStream.onResponseData]: Error decoding subsequent chunk with charset. Disconnecting.', decodingError);
                this.disconnect(event.data);
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
        this.content += this.decoder!.decode(); // finish stream

        this.filteringLog.publishEvent({
            type: FilteringEventType.ContentFilteringStart,
            data: {
                requestId: this.context.requestId,
            },
        });

        const { contentTypeHeader, statusCode } = this.context;

        if (statusCode !== 200) {
            this.write(this.content);
            return;
        }

        const charset = parseCharsetFromHeader(contentTypeHeader);

        if (charset) {
            if (SUPPORTED_CHARSETS.indexOf(charset) < 0) {
                // Charset is detected and it is not supported
                logger.warn(`[tsweb.ContentStream.onResponseFinish]: skipping request ${this.context.requestId} with Content-Type ${this.context.contentTypeHeader}`);
                this.write(this.content);
                return;
            }
            this.setCharset(charset);
        }

        // Unicode replacement character (U+FFFD) that appears when the decoder encounters
        // bytes that cannot be decoded using the current charset. Its presence indicates
        // that either the charset was incorrectly determined or the original content
        // contains invalid byte sequences for the specified encoding.
        const REPLACEMENT_CHAR = '\uFFFD';

        // This indicates the original byte stream was likely invalid for the determined charset.
        // In this case, we write the raw chunks directly to the filter.
        if (this.content.includes(REPLACEMENT_CHAR)) {
            logger.debug(`[tsweb.ContentStream.onResponseFinish]: Writing raw chunks for request ${this.context.requestId}`);
            // Write all buffered raw chunks directly
            for (const chunk of this.rawChunks) {
                this.filter.write(chunk);
            }
            this.filter.close();

            // Clear buffers regardless of fallback success/failure before returning
            this.rawChunks = [];
            this.content = '';
            return;
        }

        // --- If we reach here, decoding succeeded without replacement characters ---

        // Clear raw chunks as they are no longer needed
        this.rawChunks = [];

        this.content = this.contentStringFilter.applyRules(this.content);

        this.write(this.content);

        this.filteringLog.publishEvent({
            type: FilteringEventType.ContentFilteringFinish,
            data: {
                requestId: this.context.requestId,
            },
        });
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
