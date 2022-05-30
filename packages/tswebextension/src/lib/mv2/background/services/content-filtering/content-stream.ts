import { TextEncoder, TextDecoder } from 'text-encoding';
import { WebRequest } from 'webextension-polyfill';
import { RequestType, logger } from '@adguard/tsurlfilter';

import {
    DEFAULT_CHARSET,
    LATIN_1,
    SUPPORTED_CHARSETS,
    WIN_1252,
    parseCharsetFromHtml,
    parseCharsetFromCss,
    parseCharsetFromHeader,
} from './charsets';
import { RequestContext } from '../../request';
import { FilteringEventType, FilteringLog } from '../../../../common';
import { ContentStringFilterInterface } from './content-string-filter';

/**
 * Content Stream Filter class
 *
 * Encapsulates response data stream filtering logic
 * https://mail.mozilla.org/pipermail/dev-addons/2017-April/002729.html
 */
export class ContentStream {
    /**
     * Request context
     *
     * This object is mutated during request processing
     */
    private context: RequestContext;

    /**
     * Content Filter
     *
     * Modify content with specified rules
     */
    private contentStringFilter: ContentStringFilterInterface;

    /**
     * Web request filter
     */
    private filter: WebRequest.StreamFilter;

    /**
     * Request charset
     */
    private charset: string | undefined;

    /**
     * Content
     */
    private content: string;

    /**
     * Decoder instance
     */
    private decoder: TextDecoder | undefined;

    /**
     * Encoder instance
     */
    private encoder: TextEncoder | undefined;

    /**
     * Filtering log
     */
    private readonly filteringLog: FilteringLog;

    /**
     * Contains collection of accepted content types for stream filtering
     */
    private readonly allowedContentTypes = [
        'text/',
        'application/json',
        'application/xml',
        'application/xhtml+xml',
        'application/javascript',
        'application/x-javascript',
    ];

    constructor(
        context: RequestContext,
        contentStringFilter: ContentStringFilterInterface,
        streamFilterCreator: (id: string) => WebRequest.StreamFilter,
        filteringLog: FilteringLog,
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

    public init(): void {
        this.initEncoders();
        this.initFilter();
    }

    /**
     * Writes data to stream
     *
     * @param content
     */
    public write(content: string): void {
        this.filter.write(this.encoder!.encode(content));
        this.filter.close();
    }

    /**
     * Sets charset
     *
     * @param charset
     */
    public setCharset(charset: string | null): void {
        if (charset) {
            this.charset = charset;
            this.initEncoders();
        }
    }

    /**
     * Disconnects filter from stream
     *
     * @param data
     */
    public disconnect(data: BufferSource): void {
        this.filter.write(data as ArrayBuffer);
        this.filter.disconnect();
    }

    /**
     * Initializes encoders
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

    private initFilter(): void {
        this.filter.ondata = this.onResponseData;
        this.filter.onstop = this.onResponseFinish;
        this.filter.onerror = this.onResponseError;
    }

    private shouldProccessFiltering(): boolean {
        const { requestType, contentTypeHeader } = this.context;
        if (requestType === RequestType.Other || requestType === RequestType.XmlHttpRequest) {
            return !!contentTypeHeader && this.allowedContentTypes.some((contentType) => {
                return contentTypeHeader.indexOf(contentType) === 0;
            });
        }

        return true;
    }

    private onResponseData(event: WebRequest.StreamFilterEventData): void {
        if (!this.shouldProccessFiltering()) {
            this.disconnect(event.data);
            return;
        }

        if (!this.charset) {
            try {
                let charset;
                /**
                 * If this.charset is undefined and requestType is Document or Subdocument, we try
                 * to detect charset from page <meta> tags
                 */
                if (this.context.requestType === RequestType.Subdocument
                    || this.context.requestType === RequestType.Document) {
                    charset = ContentStream.parseHtmlCharset(event.data);
                }

                /**
                 * If this.charset is undefined and requestType is Stylesheet, we try
                 * to detect charset from css directive
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

    private onResponseError(): void {
        if (this.filter.error && this.filter.error) {
            logger.info(this.filter.error);
        }
    }

    private onResponseFinish(): void {
        this.content += this.decoder!.decode(); // finish stream

        this.filteringLog.publishEvent({
            type: FilteringEventType.CONTENT_FILTERING_START,
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
            type: FilteringEventType.CONTENT_FILTERING_FINISH,
            data: {
                requestId: this.context.requestId,
            },
        });
    }

    /**
     * Parses charset from html
     *
     * @param data
     * @returns {*}
     */
    private static parseHtmlCharset(data: BufferSource): string | null {
        const decoded = new TextDecoder('utf-8').decode(data).toLowerCase();
        return parseCharsetFromHtml(decoded);
    }

    /**
     * Parses charset from html
     *
     * @param data
     * @returns {*}
     */
    private static parseCssCharset(data: BufferSource): string | null {
        const decoded = new TextDecoder('utf-8').decode(data).toLowerCase();
        return parseCharsetFromCss(decoded);
    }
}
