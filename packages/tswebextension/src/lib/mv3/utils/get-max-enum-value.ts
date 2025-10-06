/**
 * Gets the maximum numeric value from a TypeScript enum.
 *
 * @param enumObj TypeScript enum object to analyze.
 *
 * @returns The maximum numeric value found in the enum.
 */
export function getMaxEnumValue(enumObj: Record<string, number | string>): number {
    const numericValues = Object.values(enumObj).filter((v): v is number => typeof v === 'number');

    return Math.max(...numericValues);
}
