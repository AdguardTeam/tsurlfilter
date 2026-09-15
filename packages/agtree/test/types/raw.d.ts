/**
 * @file Ambient declaration for Vite `?raw` text imports used in benchmarks.
 *
 * Lets both the Node and browser (Chromium/Firefox) benchmark runners import
 * fixture files as inlined strings via `import text from './file.txt?raw'`.
 */

declare module '*?raw' {
    const content: string;
    export default content;
}
