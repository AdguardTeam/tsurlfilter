import { CRLF, EMPTY, LF } from '../../src/utils/constants';
import { PositionProvider } from '../../src/utils/position-provider';

const fixtureMatrix: string[][] = [
    ['a', 'b', 'c'],
    ['d', 'e', 'f', 'g'],
    ['h', 'i'],
];

describe('PositionProvider', () => {
    describe('convertOffsetToPosition', () => {
        test('should work for valid offsets', () => {
            const fixture = fixtureMatrix.map((line) => line.join(EMPTY)).join(LF);
            const provider = new PositionProvider(fixture);

            for (let i = 0; i < fixtureMatrix.length; i += 1) {
                for (let j = 0; j < fixtureMatrix[i].length; j += 1) {
                    expect(provider.convertOffsetToPosition(fixture.indexOf(fixtureMatrix[i][j]))).toEqual({
                        line: i + 1,
                        column: j + 1,
                    });
                }
            }
        });

        test('should work for valid offsets if the new line is CRLF', () => {
            const fixture = fixtureMatrix.map((line) => line.join(EMPTY)).join(CRLF);
            const provider = new PositionProvider(fixture);

            for (let i = 0; i < fixtureMatrix.length; i += 1) {
                for (let j = 0; j < fixtureMatrix[i].length; j += 1) {
                    expect(provider.convertOffsetToPosition(fixture.indexOf(fixtureMatrix[i][j]))).toEqual({
                        line: i + 1,
                        column: j + 1,
                    });
                }
            }
        });

        test('should work for input.length', () => {
            const fixture = fixtureMatrix.map((line) => line.join(EMPTY)).join(LF);
            const provider = new PositionProvider(fixture);

            expect(provider.convertOffsetToPosition(fixture.length)).toEqual({
                line: fixtureMatrix.length,
                column: fixtureMatrix[fixtureMatrix.length - 1].length + 1,
            });
        });

        test('should return null for invalid offsets', () => {
            const fixture = fixtureMatrix.map((line) => line.join(EMPTY)).join(LF);
            const provider = new PositionProvider(fixture);

            expect(provider.convertOffsetToPosition(-1)).toBeNull();
            expect(provider.convertOffsetToPosition(fixture.length + 1)).toBeNull();
        });
    });
});
