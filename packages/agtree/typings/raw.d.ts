/**
 * @file Ambient declaration for Vite `?raw` text imports used in benchmarks.
 *
 * Lets the Node benchmark runner import fixture files as inlined strings via
 * `import text from './file.txt?raw'`.
 */

declare module '*?raw' {
    const content: string;
    export default content;
}
