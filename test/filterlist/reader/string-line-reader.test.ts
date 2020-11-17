import { StringLineReader } from '../../../src/filterlist/reader/string-line-reader';

describe('StringLineReader Test', () => {
    it('works if reader gets lines', () => {
        let reader;
        let line;

        reader = new StringLineReader('');
        expect(reader).toBeTruthy();
        expect(reader.readLine()).toBeFalsy();

        reader = new StringLineReader('one line');
        expect(reader).toBeTruthy();
        line = reader.readLine();
        expect(line).toBe('one line');
        expect(reader.readLine()).toBeFalsy();
        expect(reader.readLine()).toBeFalsy();

        reader = new StringLineReader('one line\n');
        expect(reader).toBeTruthy();
        line = reader.readLine();
        expect(line).toBe('one line');
        expect(reader.readLine()).toBeFalsy();
        expect(reader.readLine()).toBeFalsy();

        reader = new StringLineReader('one line\ntwo lines');
        expect(reader).toBeTruthy();
        line = reader.readLine();
        expect(line).toBe('one line');
        line = reader.readLine();
        expect(line).toBe('two lines');
        expect(reader.readLine()).toBeFalsy();
        expect(reader.readLine()).toBeFalsy();
    });
});
