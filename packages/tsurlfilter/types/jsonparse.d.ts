/// <reference types="node" />

declare module 'jsonparse' {
    export class Parser {
        static C: {
            LEFT_BRACE: number;
            RIGHT_BRACE: number;
            LEFT_BRACKET: number;
            RIGHT_BRACKET: number;
            COLON: number;
            COMMA: number;
            TRUE: number;
            FALSE: number;
            NULL: number;
            STRING: number;
            NUMBER: number;
            START: number;
            STOP: number;
            TRUE1: number;
            TRUE2: number;
            TRUE3: number;
            FALSE1: number;
            FALSE2: number;
            FALSE3: number;
            FALSE4: number;
            NULL1: number;
            NULL2: number;
            NULL3: number;
            NUMBER1: number;
            NUMBER3: number;
            STRING1: number;
            STRING2: number;
            STRING3: number;
            STRING4: number;
            STRING5: number;
            STRING6: number;
            VALUE: number;
            KEY: number;
            OBJECT: number;
            ARRAY: number;
        };

        tState: number;
        value: any;
        string: string | undefined;
        stringBuffer: Buffer;
        stringBufferOffset: number;
        unicode: string | undefined;
        highSurrogate: number | undefined;
        key: string | undefined;
        mode: number | undefined;
        stack: Array<{ value: any; key: string | undefined; mode: number | undefined }>;
        state: number;
        bytes_remaining: number;
        bytes_in_sequence: number;
        temp_buffs: { '2': Buffer; '3': Buffer; '4': Buffer };
        offset: number;

        constructor();

        static toknam(code: number): string;

        onError(err: Error): void;
        charError(buffer: Buffer, i: number): void;
        appendStringChar(char: number): void;
        appendStringBuf(buf: Buffer, start?: number, end?: number): void;
        write(buffer: Buffer | string): void;
        onToken(token: number, value: any): void;
        parseError(token: number, value: any): void;
        push(): void;
        pop(): void;
        emit(value: any): void;
        onValue(value: any): void;
    }

    export default Parser;
}
