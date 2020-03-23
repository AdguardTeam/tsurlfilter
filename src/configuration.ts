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
}

/**
 * Application configuration class
 */
class Configuration implements IConfiguration {
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
}

export const config = new Configuration();
