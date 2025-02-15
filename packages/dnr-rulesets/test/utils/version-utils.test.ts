import { generatePatchVersion, generateTimestampFromVersion } from '../../src/utils/version-utils';

describe('Utils tests', () => {
    describe('generatePatchVersion', () => {
        test.each([
            {
                actual: 1739560493923,
                expected: '20250214191453',
            },
            {
                actual: 1739511493935,
                expected: '20250214053813',
            },
            {
                actual: 1739560443945,
                expected: '20250214191403',
            },
        ])('should generate patch version for $actual', ({ actual, expected }) => {
            expect(generatePatchVersion(actual)).toBe(expected);
        });
    });

    describe('generateTimestampFromVersion', () => {
        it('generateTimestampFromVersion - patch version is not generated previously', () => {
            const testTimestamp = 12345;
            jest.spyOn(Date, 'now').mockReturnValue(testTimestamp);

            expect(generateTimestampFromVersion('2.1.0')).toBe(testTimestamp);
        });

        describe('generateTimestampFromVersion - generated patch version', () => {
            test.each([
                {
                    actual: '1.2.20250215191524',
                    expected: 1739646924000,
                },
                {
                    actual: '2.0.20250310021655',
                    expected: 1741573015000,
                },
            ])('should generate timestamp from version $actual', ({ actual, expected }) => {
                expect(generateTimestampFromVersion(actual)).toBe(expected);
            });
        });
    });
});
