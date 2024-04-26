import { BinaryMap } from '../../src/utils/binary-map';
import { ByteBuffer } from '../../src/utils/byte-buffer';
import { getAverageValue, getRandomNumber } from './helpers';

/**
 * Last benchmark result:
 *
 * Env: MacOS, i7, 16GB ram.
 * 10000 rounds.
 * ┌──────────────┬────────────┬─────────────────┐
 * │ dataset size │   map (ms) │ binary map (ms) │
 * ├──────────────┼────────────┼─────────────────┤
 * │ 100          │ 0.000244   │  0.0005         │
 * │ 1000         │ 0.00022    │  0.000301       │
 * │ 10000        │ 0.000263   │  0.000406       │
 * │ 100000       │ 0.000444   │  0.000807       │
 * └──────────────┴────────────┴─────────────────┘
 */
describe('Performance benchmark', () => {
    const ROUNDS = 10_000;

    const MIN_SIZE_EXPONENT = 2;
    const MAX_SIZE_EXPONENT = 5;

    it('should be fast', () => {
        const res: { [size: number]: { [structure: string]: number } } = {};

        for (let i = MIN_SIZE_EXPONENT; i <= MAX_SIZE_EXPONENT; i += 1) {
            const size = 10 ** i;

            const buffer = new ByteBuffer();
            const map = new Map<number, number>();

            for (let j = 0; j < size; j += 1) {
                map.set(j, j);
            }

            const binaryMap = BinaryMap.create(map, buffer);

            const mapMeasurements: number[] = [];
            const binaryMapMeasurements: number[] = [];

            for (let k = 0; k < ROUNDS; k += 1) {
                const key = getRandomNumber(size);

                let start = performance.now();
                map.get(key);
                mapMeasurements.push(performance.now() - start);

                start = performance.now();
                BinaryMap.get(key, buffer, binaryMap);
                binaryMapMeasurements.push(performance.now() - start);
            }

            res[size] = {
                map: getAverageValue(mapMeasurements),
                'binary map': getAverageValue(binaryMapMeasurements),
            };
        }

        // eslint-disable-next-line no-console
        console.table(res);

        expect(true).toBe(true);
    });
});
