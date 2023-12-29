/**
 * @file Utility functions for location and location range management.
 */

import { defaultLocation, type Location, type LocationRange } from '../parser/common';

/**
 * Shifts the specified location by the specified offset.
 *
 * @param loc Location to shift
 * @param offset Offset to shift by
 * @returns Location shifted by the specified offset
 */
export function shiftLoc(loc: Location, offset: number): Location {
    return {
        offset: loc.offset + offset,
        line: loc.line,
        column: loc.column + offset,
    };
}

/**
 * Adds two locations.
 *
 * @param loc1 Location 1
 * @param loc2 Location 2
 * @returns Location 1 + Location 2
 */
export function addLoc(loc1: Location, loc2: Location): Location {
    // If loc2 is the default location, then just return loc1
    return {
        offset: loc1.offset + loc2.offset - defaultLocation.offset,
        line: loc1.line + loc2.line - defaultLocation.line,
        column: loc1.column + loc2.column - defaultLocation.column,
    };
}

/**
 * Calculates a location range from the specified base location and offsets.
 *
 * Since every adblock rule is a single line, the start and end locations
 * of the range will have the same line, no need to calculate it here.
 *
 * @param loc Base location
 * @param startOffset Start offset
 * @param endOffset End offset
 * @returns Calculated location range
 */
export function locRange(loc: Location, startOffset: number, endOffset: number): LocationRange {
    return {
        start: shiftLoc(loc, startOffset),
        end: shiftLoc(loc, endOffset),
    };
}
