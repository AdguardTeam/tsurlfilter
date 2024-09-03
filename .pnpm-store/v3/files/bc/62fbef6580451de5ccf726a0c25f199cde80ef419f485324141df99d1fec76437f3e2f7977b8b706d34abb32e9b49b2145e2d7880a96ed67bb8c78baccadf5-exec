# Installation
> `npm install --save @types/download`

# Summary
This package contains type definitions for download (https://github.com/kevva/download).

# Details
Files were exported from https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/download.
## [index.d.ts](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/download/index.d.ts)
````ts
// Type definitions for download 8.0
// Project: https://github.com/kevva/download
// Definitions by: Nico Jansen <https://github.com/nicojs>
//                 BendingBender <https://github.com/BendingBender>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

/// <reference types="node" />
import { DecompressOptions } from "decompress";
import { GotEmitter, GotOptions } from "got";
import { Duplex } from "stream";

declare namespace download {
    interface DownloadOptions extends DecompressOptions, GotOptions<string | null> {
        /**
         * If set to `true`, try extracting the file using
         * [`decompress`](https://github.com/kevva/decompress).
         *
         * @default false
         */
        extract?: boolean | undefined;

        /**
         * Name of the saved file.
         */
        filename?: string | undefined;
    }
}

/**
 * Download and extract files.
 *
 * @param url URL to download.
 * @param destination Path to where your file will be written.
 * @param options Same options as [`got`](https://github.com/sindresorhus/got#options)
 * and [`decompress`](https://github.com/kevva/decompress#options) in addition to the
 * ones from this package.
 *
 * @example
 * import fs from 'fs';
 * import download = require('download');
 *
 * (async () => {
 *     await download('http://unicorn.com/foo.jpg', 'dist');
 *
 *     fs.writeFileSync('dist/foo.jpg', await download('http://unicorn.com/foo.jpg'));
 *
 *     download('unicorn.com/foo.jpg').pipe(fs.createWriteStream('dist/foo.jpg'));
 *
 *     await Promise.all([
 *         'unicorn.com/foo.jpg',
 *         'cats.com/dancing.gif'
 *     ].map(url => download(url, 'dist')));
 * })();
 */
declare function download(
    url: string,
    destination?: string,
    options?: download.DownloadOptions,
): Promise<Buffer> & GotEmitter & Duplex;
declare function download(url: string, options?: download.DownloadOptions): Promise<Buffer> & GotEmitter & Duplex;

export = download;

````

### Additional Details
 * Last updated: Tue, 06 Jul 2021 20:32:47 GMT
 * Dependencies: [@types/got](https://npmjs.com/package/@types/got), [@types/decompress](https://npmjs.com/package/@types/decompress), [@types/node](https://npmjs.com/package/@types/node)
 * Global values: none

# Credits
These definitions were written by [Nico Jansen](https://github.com/nicojs), and [BendingBender](https://github.com/BendingBender).
