/**
 * @file Error messages used in the tokenizer.
 */

export const enum ErrorMessage {
    UnexpectedCharInUrl = 'Unexpected character in URL.',
    UnexpectedEofInEscaped = 'Unexpected end of file while parsing escaped code point.',
    UnexpectedEofInString = 'Unexpected end of file while parsing string token.',
    UnexpectedEofInUrl = 'Unexpected end of file while parsing URL.',
    UnexpectedNewlineInString = 'Unexpected newline while parsing string token.',
    InvalidEscapeSequence = 'Invalid escape sequence.',
    UnterminatedComment = 'Unterminated comment.',
}
