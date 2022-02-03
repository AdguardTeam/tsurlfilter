import { TextEncoder, TextDecoder } from 'text-encoding';
import { WebRequest } from 'webextension-polyfill';
import { RequestType, logger } from '@adguard/tsurlfilter';

import {
    DEFAULT_CHARSET,
    LATIN_1,
    SUPPORTED_CHARSETS,
    WIN_1252,
    parseCharsetFromHtml,
} from './charsets';
import { RequestContext } from '../../request';
import { parseCharsetFromHeader } from './charsets';
import { FilteringLog } from '../../filtering-log';
import { contentFilter } from './content-filter';

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
    private readonly modificationsListener: FilteringLog;

    constructor(
        context: RequestContext,
        filterCreator: (id: string) => WebRequest.StreamFilter,
        modificationsListener: FilteringLog,
    ) {
        this.content = '';
        this.context = context;

        this.modificationsListener = modificationsListener;
        this.filter = filterCreator(context.requestId);

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

    private onResponseData(event: WebRequest.StreamFilterEventData): void {
        if (!this.charset) {
            try {
                let charset;
                /**
                 * If this.charset is undefined and requestType is DOCUMENT or SUBDOCUMENT, we try
                 * to detect charset from page <meta> tags
                 */
                if (this.context.requestType === RequestType.Subdocument
                    || this.context.requestType === RequestType.Document) {
                    charset = ContentStream.parseCharset(event.data);
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

        this.modificationsListener.addContentFilteringStartEvent({
            requestId: this.context.requestId,
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


        this.content = contentFilter.applyHtmlRules(this.content, this.context);

        // response content is over 3MB, ignore it
        if (this.content.length <= 3 * 1024 * 1024) {
            this.content = contentFilter.applyReplaceRules(this.content, this.context);
        }

        this.write(this.content);

        this.modificationsListener.addContentFilteringFinishEvent({
            requestId: this.context.requestId,
        });
    }

    /**
     * Parses charset from data
     * 
     * @param data
     * @returns {*}
     */
    private static parseCharset(data: BufferSource): string | null {
        const decoded = new TextDecoder('utf-8').decode(data).toLowerCase();
        return parseCharsetFromHtml(decoded);
    }
}
