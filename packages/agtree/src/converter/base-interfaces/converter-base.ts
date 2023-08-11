/**
 * @file Base class for converters
 *
 * TS doesn't support abstract static methods, so we should use
 * a workaround and extend this class instead of implementing it
 */

/* eslint-disable jsdoc/require-returns-check */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { NotImplementedError } from '../../errors/not-implemented-error';

/**
 * Basic class for rule converters
 */
export class ConverterBase {
    /**
     * Converts some data to AdGuard format
     *
     * @param data Data to convert
     * @returns Converted data
     * @throws If the data is invalid or incompatible
     */
    public static convertToAdg(data: unknown): unknown {
        throw new NotImplementedError();
    }

    /**
     * Converts some data to Adblock Plus format
     *
     * @param data Data to convert
     * @returns Converted data
     * @throws If the data is invalid or incompatible
     */
    public static convertToAbp(data: unknown): unknown {
        throw new NotImplementedError();
    }

    /**
     * Converts some data to uBlock Origin format
     *
     * @param data Data to convert
     * @returns Converted data
     * @throws If the data is invalid or incompatible
     */
    public static convertToUbo(data: unknown): unknown {
        throw new NotImplementedError();
    }
}
