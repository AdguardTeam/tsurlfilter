import { WebRequest } from 'webextension-polyfill';
import { TextEncoder, TextDecoder } from 'text-encoding';
import { RequestType, logger } from '@adguard/tsurlfilter';

import {
    DEFAULT_CHARSET,
    LATIN_1,
    SUPPORTED_CHARSETS,
    WIN_1252,
    parseCharsetFromHtml,
} from './charsets';

/**
 * Content Filter class
 *
 * Encapsulates response data filter logic
 * https://mail.mozilla.org/pipermail/dev-addons/2017-April/002729.html
 */
export class ContentFilter {
    /**
     * Web request filter
     */
    filter: WebRequest.StreamFilter;

    /**
     * Request type
     */
    requestType: RequestType;

    /**
     * Request charset
     */
    charset: string | undefined;

    /**
     * Content
     */
    content: string;

    /**
     * Decoder instance
     */
    decoder: TextDecoder | undefined;

    /**
     * Encoder instance
     */
    encoder: TextEncoder | undefined;

    /**
     * Result callback
     */
    onContentCallback: (data: string) => void;

    /**
     * Constructor
     *
     * @param filter implementation
     * @param requestType Request type
     * @param onContentCallback
     */
    constructor(
        filter: WebRequest.StreamFilter,
        requestType: RequestType,
        onContentCallback: (data: string) => void,
    ) {
        this.filter = filter;
        this.requestType = requestType;

        this.content = '';
        this.onContentCallback = onContentCallback;

        this.initEncoders();
        this.initFilter();
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

    /**
     * Initializes inner filter
     */
    private initFilter(): void {
        this.filter.ondata = (event): void => {
            if (!this.charset) {
                try {
                    let charset;
                    /**
                     * If this.charset is undefined and requestType is DOCUMENT or SUBDOCUMENT, we try
                     * to detect charset from page <meta> tags
                     */
                    if (this.requestType === RequestType.Subdocument
                        || this.requestType === RequestType.Document) {
                        charset = ContentFilter.parseCharset(event.data);
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
        };

        this.filter.onstop = (): void => {
            this.content += this.decoder!.decode(); // finish stream
            this.onContentCallback(this.content);
        };

        this.filter.onerror = (): void => {
            if (this.filter.error && this.filter.error) {
                logger.info(this.filter.error);
            }
        };
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
    setCharset(charset: string | null): void {
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
    private disconnect(data: BufferSource): void {
        this.filter.write(data as ArrayBuffer);
        this.filter.disconnect();
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
