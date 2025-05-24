/**
 * @file Position provider class.
 */

import { CR, FF, LF } from './constants.js';

/**
 * Represents a position in the source code.
 */
export interface Position {
    /**
     * 1-based line number
     */
    line: number;

    /**
     * 1-based column number
     */
    column: number;
}

/**
 * Class responsible for converting a character offset in source code into a line and column position.
 * This conversion is particularly needed in linters and VSCode extensions,
 * where line and column numbers are more human-friendly and intuitive than character offsets.
 * Moreover, the VSCode diagnostics API does not directly support character offsets,
 * it also requires line and column numbers.
 */
export class PositionProvider {
    /**
     * Maps a character offset to a line number.
     */
    private offsetToLine: number[];

    /**
     * Maps a line number to the starting character offset of that line.
     */
    private lineStartOffsets: number[];

    /**
     * Constructs a new PositionProvider instance.
     *
     * @param sourceCode The source code as a string.
     */
    constructor(sourceCode: string) {
        this.offsetToLine = [];
        this.lineStartOffsets = [0];

        let currentLine = 0;
        for (let i = 0; i < sourceCode.length; i += 1) {
            this.offsetToLine[i] = currentLine;

            // Handle different types of line breaks: LF, FF, and CR
            if (sourceCode[i] === LF || sourceCode[i] === FF || sourceCode[i] === CR) {
                currentLine += 1;
                this.lineStartOffsets[currentLine] = (sourceCode[i] === CR && sourceCode[i + 1] === LF)
                    ? i + 2
                    : i + 1;

                if (sourceCode[i] === CR && sourceCode[i + 1] === LF) {
                    // Skip the '\n' in a '\r\n' sequence
                    i += 1;
                }
            }
        }

        // Handle the case where the last offset is at the end of the source code
        this.offsetToLine[sourceCode.length] = currentLine;
    }

    /**
     * Converts a character offset to a line and column position.
     *
     * @param offset The zero-based character offset in the source code.
     * @returns A Position object containing the 1-based line and column number, or null if the offset is out of range.
     */
    convertOffsetToPosition(offset: number): Position | null {
        if (offset < 0 || offset > this.offsetToLine.length - 1) {
            return null;
        }

        const line = this.offsetToLine[offset];
        const lineStartOffset = this.lineStartOffsets[line];
        return {
            line: line + 1,
            column: offset - lineStartOffset + 1,
        };
    }
}
