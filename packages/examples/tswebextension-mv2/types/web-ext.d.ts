/**
 * @file
 * Type definitions for the web-ext library, accommodating the lack of provided types or a @types/web-ext package.
 */
// web-ext.d.ts
declare module 'web-ext' {
    namespace cmd {
        interface RunOptions {
            sourceDir: string;
            firefox: string;
            args: string[];
        }

        interface RunMethodOptions {
            shouldExitProgram: boolean;
        }

        function run(options: RunOptions, methodOptions: RunMethodOptions): Promise<any>;
    }

    export { cmd };
}
