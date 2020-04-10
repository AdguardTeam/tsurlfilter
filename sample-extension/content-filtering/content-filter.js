/* eslint-disable import/no-unresolved, import/extensions */
import * as AGUrlFilter from '../engine.js';
import {
    DEFAULT_CHARSET, LATIN_1, WIN_1252, SUPPORTED_CHARSETS,
} from './charsets.js';

/**
 * Content Filter class
 *
 * Encapsulates response data filter logic
 * https://mail.mozilla.org/pipermail/dev-addons/2017-April/002729.html
 */
export class ContentFilter {
    /**
     * Web request filter implementation
     */
    filter;

    /**
     * Request type
     */
    requestType;

    /**
     * Request charset
     */
    charset;

    /**
     * Content
     */
    content;

    /**
     * Decoder instance
     */
    decoder;

    /**
     * Encoder instance
     */
    encoder;

    /**
     * Result callback
     */
    onContentCallback;

    /**
     * Constructor
     *
     * @param requestId Request identifier
     * @param requestType Request type
     * @param charset encoding
     * @param onContentCallback
     */
    constructor(requestId, requestType, charset, onContentCallback) {
        // TODO: Pass this implementation as parameter
        // eslint-disable-next-line no-undef
        this.filter = chrome.webRequest.filterResponseData(requestId);
        this.requestType = requestType;
        this.charset = charset;

        this.content = '';
        this.onContentCallback = onContentCallback;

        this.initEncoders();
        this.initFilter();
    }

    /**
     * Initializes encoders
     */
    initEncoders() {
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
    initFilter() {
        this.filter.ondata = (event) => {
            if (!this.charset) {
                try {
                    let charset;
                    /**
                     * If this.charset is undefined and requestType is DOCUMENT or SUBDOCUMENT, we try
                     * to detect charset from page <meta> tags
                     */
                    if (this.requestType === AGUrlFilter.RequestType.Subdocument
                        || this.requestType === AGUrlFilter.RequestType.Document) {
                        charset = this.parseCharset(event.data);
                    }

                    /**
                     * If we fail to find charset from meta tags we set charset to 'iso-8859-1',
                     * because this charset allows to decode and encode data without errors
                     */
                    if (!charset) {
                        charset = LATIN_1;
                    }

                    if (charset && SUPPORTED_CHARSETS.indexOf(charset) >= 0) {
                        this.charset = charset;
                        this.initEncoders();
                        this.content += this.decoder.decode(event.data, { stream: true });
                    } else {
                        // Charset is not supported
                        this.disconnect(event.data);
                    }
                } catch (e) {
                    console.warn(e);
                    // on error we disconnect the filter from the request
                    this.disconnect(event.data);
                }
            } else {
                this.content += this.decoder.decode(event.data, { stream: true });
            }
        };

        this.filter.onstop = () => {
            this.content += this.decoder.decode(); // finish stream
            this.onContentCallback(this.content);
        };

        this.filter.onerror = () => {
            throw this.filter.error;
        };
    }

    /**
     * Disconnects filter from stream
     *
     * @param data
     */
    disconnect(data) {
        this.filter.write(data);
        this.filter.disconnect();

        this.onContentCallback(null);
    }

    /**
     * Writes data to stream
     *
     * @param content
     */
    write(content) {
        this.filter.write(this.encoder.encode(content));
        this.filter.close();
    }

    /**
     * Parses charset from data, looking for:
     * <meta charset="utf-8" />
     * <meta http-equiv="Content-type" content="text/html; charset=utf-8" />
     *
     * @param data
     * @returns {*}
     */
    // eslint-disable-next-line class-methods-use-this
    parseCharset(data) {
        const decoded = new TextDecoder('utf-8').decode(data).toLowerCase();
        let match = /<meta\s*charset\s*=\s*['"](.*?)['"]/.exec(decoded);
        if (match && match.length > 1) {
            return match[1].trim().toLowerCase();
        }

        // eslint-disable-next-line max-len
        match = /<meta\s*http-equiv\s*=\s*['"]?content-type['"]?\s*content\s*=\s*[\\]?['"]text\/html;\s*charset=(.*?)[\\]?['"]/.exec(decoded);
        if (match && match.length > 1) {
            return match[1].trim().toLowerCase();
        }

        return null;
    }
}
