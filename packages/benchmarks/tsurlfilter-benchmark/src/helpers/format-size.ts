/**
 * @file Helper functions to format sizes.
 */

/**
 * Helper function to print bytes as megabytes.
 *
 * @param bytes Bytes to print.
 * @returns String representation of bytes in megabytes.
 */
export const printBytesAsMegabytes = (bytes: number): string => {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};
