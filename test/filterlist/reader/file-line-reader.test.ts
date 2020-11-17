import { FileLineReader } from '../../../src/filterlist/reader/file-line-reader';

describe('FileLineReader Test', () => {
    it('works if reader gets lines', () => {
        let line;
        let reader;

        expect(() => {
            reader = new FileLineReader('');
        }).toThrowError(/ENOENT: no such file or directory.+/);

        expect(() => {
            reader = new FileLineReader('incorrect path');
        }).toThrowError(/ENOENT: no such file or directory.+/);

        reader = new FileLineReader('./test/resources/hosts');
        expect(reader).toBeTruthy();
        line = reader.readLine();
        expect(line).toBe('# This hosts file is a merged collection of hosts from reputable sources,');
        line = reader.readLine();
        expect(line).toBe('# with a dash of crowd sourcing via Github');
    });
});
