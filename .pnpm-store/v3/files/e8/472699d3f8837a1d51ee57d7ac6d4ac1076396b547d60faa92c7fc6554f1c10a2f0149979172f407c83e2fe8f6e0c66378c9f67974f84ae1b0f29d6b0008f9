export declare type Stderr = {
    debug: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
};
declare type CreateConsoleStderrParams = {
    _console?: typeof console;
    programName: string;
    verboseLevel: number;
};
export declare const createConsoleStderr: ({ _console, programName, verboseLevel, }: CreateConsoleStderrParams) => Stderr;
export declare type InMemoryStderr = Stderr & {
    messages: {
        debug: string[];
        error: string[];
        info: string[];
    };
};
export declare const createInMemoryStderr: () => InMemoryStderr;
export declare type Stdout = {
    write: (message: string) => void;
};
export declare const createConsoleStdout: ({ _console }?: {
    _console?: Console | undefined;
}) => Stdout;
export declare type InMemoryStdout = Stdout & {
    output: string;
};
export declare const createInMemoryStdout: () => InMemoryStdout;
export {};
