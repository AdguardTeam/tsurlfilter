/**
 * @jest-environment jsdom
 */

import { DocumentParser } from '../../../../src/background/services/content-filtering/doc-parser';

describe('Document parser wrapper', () => {
    it('checks document parser', () => {
        const parser = new DocumentParser();
        const doc = parser.parse('<html><body></body></html>');
        expect(doc).not.toBeNull();
    });

    it('checks document parser - namespace', () => {
        const parser = new DocumentParser();
        // eslint-disable-next-line max-len
        const doc = parser.parse('<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en"><body></body></html>');
        expect(doc).not.toBeNull();
    });
});
