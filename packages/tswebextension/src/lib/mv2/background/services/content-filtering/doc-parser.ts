import { EntityHandler } from './entity-handler';

/**
 * Document parser wrapper.
 */
export class DocumentParser {
    private readonly parser: DOMParser;

    private readonly parsererrorNS: string | null;

    /**
     * Constructor.
     */
    constructor() {
        // eslint-disable-next-line no-undef
        this.parser = new DOMParser();
        const errorneousParse = this.parser.parseFromString('<', 'text/xml');
        this.parsererrorNS = errorneousParse.getElementsByTagName('parsererror')[0].namespaceURI;
    }

    /**
     * Checks for parse errors.
     * {@link https://developer.mozilla.org/en-US/docs/Web/API/DOMParser#Error_handling}.
     *
     * @param parsedDocument Parsed document.
     * @returns True if document cannot be parsed.
     */
    private isParseError(parsedDocument: Document): boolean {
        if (this.parsererrorNS === 'http://www.w3.org/1999/xhtml') {
            return parsedDocument.getElementsByTagName('parsererror').length > 0;
        }

        return parsedDocument.getElementsByTagNameNS(this.parsererrorNS, 'parsererror').length > 0;
    }

    /**
     * Parse html to document.
     *
     * @param html HTML content.
     * @returns Document or null if parse error occurred.
     */
    parse(html: string): Document | null {
        const doc = this.parser.parseFromString(EntityHandler.escapeEntities(html), 'text/html');
        if (this.isParseError(doc)) {
            return null;
        }

        return doc;
    }
}

export const documentParser = new DocumentParser();
