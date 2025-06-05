import { describe, it, expect } from 'vitest';
import { join } from 'path';

import { FileLineReader } from '../../../src/filterlist/reader/file-line-reader';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = new URL('.', import.meta.url).pathname;

describe('FileLineReader Test', () => {
    it('works if reader gets lines', () => {
        let line: string | null;
        let reader: FileLineReader;

        expect(() => {
            reader = new FileLineReader('');
        }).toThrowError(/ENOENT: no such file or directory.+/);

        expect(() => {
            reader = new FileLineReader('incorrect path');
        }).toThrowError(/ENOENT: no such file or directory.+/);

        reader = new FileLineReader(join(__dirname, '../../resources/hosts'));
        expect(reader).toBeTruthy();
        line = reader.readLine();
        expect(line).toBe('# This hosts file is a merged collection of hosts from reputable sources,');
        line = reader.readLine();
        expect(line).toBe('# with a dash of crowd sourcing via Github');
    });
});
