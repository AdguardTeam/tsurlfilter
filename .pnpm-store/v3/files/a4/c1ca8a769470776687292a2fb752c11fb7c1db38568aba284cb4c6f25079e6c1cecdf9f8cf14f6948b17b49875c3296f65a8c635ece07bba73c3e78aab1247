import { TextEncoder, TextDecoder } from 'text-encoding';
import { StreamFilter } from './stream-filter';
import { RequestType } from '../request-type';
import {
    DEFAULT_CHARSET,
    LATIN_1,
    SUPPORTED_CHARSETS,
    WIN_1252,
    parseCharsetFromHtml,
    parseCharsetFromCss,
} from './charsets';
import { logger } from '../utils/logger';
import { RequestContext } from './request-context';
import { NetworkRule } from '../rules/network-rule';
import { CosmeticRule } from '../rules/cosmetic-rule';

/**
 * Content Filter class
 *
 * Encapsulates response data filter logic
 * https://mail.mozilla.org/pipermail/dev-addons/2017-April/002729.html
 */
export class ContentFilter {
    /**
     * Contains collection of accepted content types
     */
    private static supportedContentTypes = [
        'text/',
        'application/json',
        'application/xml',
        'application/xhtml+xml',
        'application/javascript',
        'application/x-javascript',
    ];

    /**
     * Contains collection of accepted request types for replace rules
     */
    private static replaceRulesRequestTypes = [
        RequestType.Document,
        RequestType.Subdocument,
        RequestType.Script,
        RequestType.Stylesheet,
        RequestType.XmlHttpRequest,
    ];

    /**
     * Contains collection of accepted request types for html rules
     */
    private static htmlRulesRequestTypes = [
        RequestType.Document,
        RequestType.Subdocument,
    ];

    /**
     * Web request filter
     */
    filter: StreamFilter;

    /**
     * Request context
     */
    context: RequestContext;

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
     * Replace rules for request
     */
    replaceRules: NetworkRule[];

    /**
     * Html rules for request
     */
    htmlRules: CosmeticRule[];

    /**
     * Result callback
     */
    onContentCallback: (content: string, context: RequestContext) => void;

    /**
     * Constructor
     *
     * @param filter implementation
     * @param context request context
     * @param htmlRules
     * @param replaceRules
     * @param onContentCallback
     */
    constructor(
        filter: StreamFilter,
        context: RequestContext,
        htmlRules: CosmeticRule[],
        replaceRules: NetworkRule[],
        onContentCallback: (data: string, context: RequestContext) => void,
    ) {
        this.filter = filter;
        this.context = context;
        this.htmlRules = htmlRules;
        this.replaceRules = replaceRules;

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
            // check if app should apply decoding/encoding,
            // applications is checking ondata event,
            // because disconnecting onstart event is crashing loading of some requests
            let htmlRulesToApply: CosmeticRule[] | null = null;
            if (this.htmlRules.length > 0
                && ContentFilter.shouldApplyHtmlRules(this.context.engineRequestType)
            ) {
                htmlRulesToApply = this.htmlRules;
            }

            let replaceRulesToApply: NetworkRule[] | null = null;
            if (this.replaceRules.length > 0
                && ContentFilter.shouldApplyReplaceRule(this.context.engineRequestType, this.context.contentType!)
            ) {
                replaceRulesToApply = this.replaceRules;
            }

            if (!htmlRulesToApply && !replaceRulesToApply) {
                // disconnect on data
                this.filter.write(event.data);
                this.filter.disconnect();
                return;
            }

            if (!this.charset) {
                try {
                    let charset;
                    /**
                     * If this.charset is undefined and requestType is DOCUMENT or SUBDOCUMENT, we try
                     * to detect charset from page <meta> tags
                     */
                    if (this.context.engineRequestType === RequestType.Subdocument
                        || this.context.engineRequestType  === RequestType.Document) {
                        charset = ContentFilter.parseHtmlCharset(event.data);
                    }

                    /**
                     * If this.charset is undefined and requestType is Stylesheet, we try
                     * to detect charset from '@charset' directive
                     */
                    if (this.context.engineRequestType === RequestType.Stylesheet) {
                        charset = ContentFilter.parseCssCharset(event.data);
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
            this.onContentCallback(this.content, this.context);
        };

        this.filter.onerror = (): void => {
            if (this.filter.error) {
                // eslint-disable-next-line max-len
                logger.debug(`An error in the content filtering occurred: ${this.filter.error}, request id: ${this.context.requestId}`);
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
    private disconnect(data: ArrayBuffer): void {
        this.filter.write(data);
        this.filter.disconnect();
    }

    /**
     * Parses charset from html
     */
    private static parseHtmlCharset(data: BufferSource): string | null {
        const decoded = new TextDecoder('utf-8').decode(data).toLowerCase();
        return parseCharsetFromHtml(decoded);
    }

    /**
     * Parses charset from css
     */
    private static parseCssCharset(data: BufferSource): string | null {
        const decoded = new TextDecoder('utf-8').decode(data).toLowerCase();
        return parseCharsetFromCss(decoded);
    }

    /**
     * Checks if $replace rule should be applied to this request
     *
     * @returns {boolean}
     */
    private static shouldApplyReplaceRule(requestType: RequestType, contentType: string): boolean {
        if (ContentFilter.replaceRulesRequestTypes.indexOf(requestType) >= 0) {
            return true;
        }

        if (requestType === RequestType.Other && contentType) {
            for (let i = 0; i < ContentFilter.supportedContentTypes.length; i += 1) {
                if (contentType.indexOf(ContentFilter.supportedContentTypes[i]) === 0) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Checks if content filtration rules should by applied to this request
     * @param requestType Request type
     */
    private static shouldApplyHtmlRules(requestType: RequestType): boolean {
        return requestType === RequestType.Document
            || requestType === RequestType.Subdocument;
    }
}
