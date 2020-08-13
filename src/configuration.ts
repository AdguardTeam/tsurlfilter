/**
 * Compatibility types
 */
export enum Compatibility {
    extension = 1 << 0,
    compiler = 1 << 1,
}

/**
 * Configuration interface
 */
export interface IConfiguration {
    /**
     * {'extension'|'corelibs'} engine application type
     */
    engine: string | null;

    /**
     * {string} version
     */
    version: string | null;

    /**
     * {boolean} verbose flag
     */
    verbose: boolean;

    /**
     * Compatibility type
     */
    compatibility: Compatibility | null;
}

/**
 * Application configuration class
 */
class Configuration implements IConfiguration {
    private defaultConfig: IConfiguration = {
        engine: null,
        version: null,
        verbose: false,
        compatibility: null,
    };

    /**
     * {'extension'|'corelibs'} engine application type
     */
    public engine: string | null = null;

    /**
     * {string} version
     */
    public version: string | null = null;

    /**
     * {boolean} verbose flag
     */
    public verbose = false;

    /**
     * compatibility flag
     */
    public compatibility: Compatibility | null = Compatibility.extension;

    constructor(inputConfig?: Partial<IConfiguration>) {
        const config = { ...this.defaultConfig, ...inputConfig };
        this.engine = config.engine;
        this.version = config.version;
        this.verbose = config.verbose;
        this.compatibility = config.compatibility;
    }
}

type Partial<T> = {
    [P in keyof T]?: T[P];
};

// eslint-disable-next-line import/no-mutable-exports
export let config = new Configuration();

export const setConfiguration = (outerConfig: Partial<IConfiguration>): void => {
    config = new Configuration(outerConfig);
};
