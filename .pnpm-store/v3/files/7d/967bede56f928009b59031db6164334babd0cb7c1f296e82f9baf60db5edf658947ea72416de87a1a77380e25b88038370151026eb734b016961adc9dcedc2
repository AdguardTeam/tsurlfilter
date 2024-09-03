/// <reference types="node" />
import { Readable } from 'stream';
import { Stderr } from '../stdio';
declare type ScanFileFunction = (_path: string, isDirectory: boolean) => boolean;
declare type Files = Record<string, unknown>;
export declare type IOBaseConstructorParams = {
    filePath: string;
    stderr: Stderr;
};
export declare class IOBase {
    path: string;
    stderr: Stderr;
    files: Files;
    entries: string[];
    maxSizeBytes: number;
    shouldScanFile: ScanFileFunction;
    constructor({ filePath, stderr }: IOBaseConstructorParams);
    setScanFileCallback(callback: ScanFileFunction): void;
    getFile(path: string, fileStreamType?: 'stream' | 'string' | 'chunk'): Promise<string> | Promise<Buffer> | Promise<Readable>;
    getFilesByExt(...extensions: string[]): Promise<string[]>;
    getFiles(optionalArgument?: Function): Promise<Files>;
    getFileAsStream(path: string): Promise<Readable>;
    getFileAsString(path: string): Promise<string>;
    getChunkAsBuffer(path: string, chunkLength: number): Promise<Buffer>;
    close(): void;
}
export {};
