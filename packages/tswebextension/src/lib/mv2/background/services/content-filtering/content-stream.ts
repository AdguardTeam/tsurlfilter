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
                logger.warn((e as Error).message);
                // on error we disconnect the filter from the request
                this.disconnect(event.data);
            }
        } else {
            this.content += this.decoder!.decode(event.data, { stream: true });
        }
    }

    /**
     * Handler for response error.
     */
    private onResponseError(): void {
        if (this.filter.error && this.filter.error) {
            logger.info(this.filter.error);
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
                // eslint-disable-next-line max-len
                logger.warn(`Skipping request ${this.context.requestId} with Content-Type ${this.context.contentTypeHeader}`);
                this.write(this.content);
                return;
            }
            this.setCharset(charset);
        }

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
