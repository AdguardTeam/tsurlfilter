export interface ByteRange {
    start: number;
    end: number;
}

export interface ByteRangeMap {
    [key: string]: ByteRange;
}
