// / <reference path="../../node_modules/text-encoding" />

declare namespace TextEncoding {
    interface TextEncoderOptions {
        NONSTANDARD_allowLegacyEncoding?: boolean;
    }
    interface TextEncoderStatic {
        (utfLabel?: string, options?: TextEncoderOptions): TextEncoder;
        new (utfLabel?: string, options?: TextEncoderOptions): TextEncoder;
    }

    export const TextEncoder: {
        new (utfLabel?: string, options?: TextEncoderOptions): TextEncoder;
        (utfLabel?: string, options?: TextEncoderOptions): TextEncoder;
        encoding: string;
    };

    export const TextDecoder: {
        (label?: string, options?: TextDecoderOptions): TextDecoder;
        new (label?: string, options?: TextDecoderOptions): TextDecoder;
        encoding: string;
    };
}

interface TextEncodeOptions {
    stream?: boolean;
}

interface TextDecoderOptions {
    stream?: boolean;
}

interface TextEncoder {
    readonly encoding: string;
    encode(input?: string, options?: TextEncodeOptions): Uint8Array;
}

interface TextDecoder {
    readonly encoding: string;
    decode(input?: ArrayBuffer, options?: TextDecoderOptions): string;
}

declare module 'text-encoding' {
    export = TextEncoding;
}
