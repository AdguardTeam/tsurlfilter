/// <reference types="node" />
import { Readable } from 'stream';
import { IOBase, IOBaseConstructorParams } from './base';
import { walkPromise } from './utils';
declare type Files = {
    [filename: string]: {
        size: number;
    };
};
declare type DirectoryConstructorParams = IOBaseConstructorParams;
export declare class Directory extends IOBase {
    files: Files;
    constructor({ filePath, stderr }: DirectoryConstructorParams);
    getFiles(_walkPromise?: typeof walkPromise): Promise<Files>;
    getPath(_path: string): Promise<string>;
    getFileAsStream(_path: string, { encoding }?: {
        encoding: BufferEncoding;
    }): Promise<Readable>;
    getFileAsString(_path: string): Promise<string>;
    getChunkAsBuffer(_path: string, chunkLength: number): Promise<Buffer>;
}
export {};
