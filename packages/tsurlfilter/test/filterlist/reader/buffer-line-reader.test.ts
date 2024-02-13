import { BufferLineReader } from '../../../src/filterlist/reader/buffer-line-reader';

describe('BufferLineReader Test', () => {
    const encoder = new TextEncoder();

    it('works if reader gets lines', () => {
        let reader;
        let line;

        reader = new BufferLineReader(encoder.encode(''));
        expect(reader).toBeTruthy();
        expect(reader.readLine()).toBeFalsy();

        reader = new BufferLineReader(encoder.encode('one line'));
        expect(reader).toBeTruthy();
        line = reader.readLine();
        expect(line).toBe('one line');
        expect(reader.readLine()).toBeFalsy();
        expect(reader.readLine()).toBeFalsy();

        reader = new BufferLineReader(encoder.encode('one line\n'));
        expect(reader).toBeTruthy();
        line = reader.readLine();
        expect(line).toBe('one line');
        expect(reader.readLine()).toBeFalsy();
        expect(reader.readLine()).toBeFalsy();

        reader = new BufferLineReader(encoder.encode('one line\ntwo lines'));
        expect(reader).toBeTruthy();
        line = reader.readLine();
        expect(line).toBe('one line');
        line = reader.readLine();
        expect(line).toBe('two lines');
        expect(reader.readLine()).toBeFalsy();
        expect(reader.readLine()).toBeFalsy();
    });

    it('does not fall in infinite loop if line starts with "\\n"', () => {
        let reader;

        reader = new BufferLineReader(encoder.encode(''));
        expect(reader).toBeTruthy();
        expect(reader.readLine()).toBeFalsy();

        reader = new BufferLineReader(encoder.encode('\n text line'));
        expect(reader).toBeTruthy();
        expect(reader.readLine()).toBe('');
        expect(reader.readLine()).toBe(' text line');

        // finally returns null
        expect(reader.readLine()).toBe(null);
    });
});
