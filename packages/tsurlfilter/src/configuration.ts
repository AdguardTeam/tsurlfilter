import { version } from '../package.json';

export const TSURLFILTER_VERSION = version;

/**
 * Compatibility types are used to configure engine for better support of different libraries
 * For example:
 *  extension doesn't support $app modifier. So if we set in configuration CompatibilityTypes.Extension,
 *  engine would ignore rules with $app modifier
 */
export enum CompatibilityTypes {
    Extension = 1 << 0,
    CoreLibs = 1 << 1,
    Dns = 1 << 2,
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
    compatibility: CompatibilityTypes | null;
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
    public compatibility: CompatibilityTypes | null = CompatibilityTypes.Extension;

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

/**
 * Checks config is compatible with input level
 * @param compatibilityLevel
 * @private
 */
export function isCompatibleWith(compatibilityLevel: CompatibilityTypes): boolean {
    if (config.compatibility === null) {
        return false;
    }
    return (config.compatibility & compatibilityLevel) === compatibilityLevel;
}

export const setConfiguration = (outerConfig: Partial<IConfiguration>): void => {
    config = new Configuration(outerConfig);
};
