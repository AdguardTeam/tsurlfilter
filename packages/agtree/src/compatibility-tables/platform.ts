/**
 * @file Platform class for hierarchical platform representation.
 * Replaces bitwise platform enums with a clean, hierarchical structure.
 */

import { AdblockProduct } from '../utils/adblockers';

/**
 * Product identifiers (short codes).
 */
export enum ProductCode {
    Adg = 'adg',
    Ubo = 'ubo',
    Abp = 'abp',
    Any = 'any',
}

/**
 * Specific (non-wildcard) product codes.
 */
export type SpecificProductCode = Exclude<ProductCode, ProductCode.Any>;

/**
 * Platform type identifiers.
 */
export enum PlatformType {
    Os = 'os',
    Cb = 'cb',
    Ext = 'ext',
    Safari = 'safari',
    Any = 'any',
}

/**
 * Specific (non-wildcard) platform types.
 */
export type SpecificPlatformType = Exclude<PlatformType, PlatformType.Any>;

/**
 * Specific platform identifiers (e.g., 'windows', 'chrome', 'android').
 */
export enum PlatformSpecific {
    Windows = 'windows',
    Linux = 'linux',
    Mac = 'mac',
    Android = 'android',
    Ios = 'ios',
    Safari = 'safari',
    Chrome = 'chrome',
    Opera = 'opera',
    Edge = 'edge',
    Firefox = 'firefox',
    ChromeMv3 = 'chrome_mv3',
    OperaMv3 = 'opera_mv3',
    EdgeMv3 = 'edge_mv3',
    FirefoxMv3 = 'firefox_mv3',
}

/**
 * Wildcard identifier for 'any' platform.
 */
export const WILDCARD_ANY = ProductCode.Any;

/**
 * Separator for platform string representation.
 */
export const PLATFORM_SEPARATOR = '_';

/**
 * Mapping from product codes to AdblockProduct enum.
 */
const PRODUCT_CODE_TO_ENUM: Record<ProductCode, AdblockProduct | typeof WILDCARD_ANY> = {
    [ProductCode.Adg]: AdblockProduct.Adg,
    [ProductCode.Ubo]: AdblockProduct.Ubo,
    [ProductCode.Abp]: AdblockProduct.Abp,
    [ProductCode.Any]: WILDCARD_ANY,
};

/**
 * Cached valid product codes. Initialized lazily on first access.
 */
let validProductCodesCache: ReadonlySet<SpecificProductCode> | null = null;

/**
 * Valid (non-wildcard) product codes. Derived from PRODUCT_CODE_TO_ENUM.
 * Adding a new product only requires updating PRODUCT_CODE_TO_ENUM.
 * Lazily initialized on first call.
 *
 * @returns Set of valid product code strings.
 */
export function getValidProductCodes(): ReadonlySet<SpecificProductCode> {
    if (validProductCodesCache === null) {
        validProductCodesCache = new Set(
            (Object.keys(PRODUCT_CODE_TO_ENUM) as ProductCode[])
                .filter((code): code is SpecificProductCode => code !== ProductCode.Any),
        );
    }
    return validProductCodesCache;
}

/**
 * Cached valid platform specifics. Initialized lazily on first access.
 */
let validPlatformSpecificsCache: ReadonlySet<PlatformSpecific> | null = null;

/**
 * Valid platform specific values.
 * Lazily initialized on first call.
 *
 * @returns Set of valid platform specific strings.
 */
export function getValidPlatformSpecifics(): ReadonlySet<PlatformSpecific> {
    if (validPlatformSpecificsCache === null) {
        validPlatformSpecificsCache = new Set(Object.values(PlatformSpecific));
    }
    return validPlatformSpecificsCache;
}

/**
 * Cached valid platform types. Initialized lazily on first access.
 */
let validPlatformTypesCache: ReadonlySet<SpecificPlatformType> | null = null;

/**
 * Valid (non-wildcard) platform types.
 * Lazily initialized on first call.
 *
 * @returns Set of valid platform type strings.
 */
export function getValidPlatformTypes(): ReadonlySet<SpecificPlatformType> {
    if (validPlatformTypesCache === null) {
        validPlatformTypesCache = new Set(
            (Object.values(PlatformType) as PlatformType[])
                .filter((t): t is SpecificPlatformType => t !== PlatformType.Any),
        );
    }
    return validPlatformTypesCache;
}

/**
 * Cached valid adblock products. Initialized lazily on first access.
 */
let validAdblockProductsCache: readonly AdblockProduct[] | null = null;

/**
 * Pre-computed array of AdblockProduct enum values for all valid (non-wildcard) products.
 * Derived from PRODUCT_CODE_TO_ENUM. Useful for initializing per-product maps without
 * repeated Platform.parse() calls.
 * Lazily initialized on first call.
 *
 * @returns Array of AdblockProduct enum values.
 */
export function getValidAdblockProducts(): readonly AdblockProduct[] {
    if (validAdblockProductsCache === null) {
        validAdblockProductsCache = Object.entries(PRODUCT_CODE_TO_ENUM)
            .filter(([, value]) => value !== WILDCARD_ANY)
            .map(([, value]) => value as AdblockProduct);
    }
    return validAdblockProductsCache;
}

/**
 * Represents a hierarchical platform query.
 * Can be specific (e.g., AdGuard for Windows) or wildcard (e.g., any AdGuard product).
 */
export class Platform {
    /**
     * Cache for concrete platforms. Populated on first access.
     */
    private static concretePlatformsCache: Platform[] | null = null;

    /**
     * Product identifier (short code).
     */
    public readonly product: ProductCode;

    /**
     * Platform type (os, cb, ext, or undefined for wildcard).
     */
    public readonly type?: PlatformType;

    /**
     * Specific platform identifier (e.g., 'windows', 'chrome', or undefined for wildcard).
     */
    public readonly specific?: PlatformSpecific;

    /**
     * Cached string representation (computed lazily).
     */
    private stringCache?: string;

    /**
     * Cached path array (computed lazily).
     */
    private pathCache?: string[];

    /**
     * Creates a platform query.
     *
     * @param product Product identifier.
     * @param type Platform type (optional for wildcard queries).
     * @param specific Specific platform (optional for wildcard queries).
     */
    constructor(product: ProductCode, type?: PlatformType, specific?: PlatformSpecific) {
        this.product = product;
        this.type = type;
        this.specific = specific;
    }

    /**
     * Gets the AdblockProduct enum for this platform.
     *
     * @returns AdblockProduct enum or 'any'.
     */
    getProductEnum(): AdblockProduct | typeof WILDCARD_ANY {
        return PRODUCT_CODE_TO_ENUM[this.product];
    }

    /**
     * Checks if this is a wildcard query (matches multiple platforms).
     *
     * @returns True if this is a wildcard query.
     */
    get isWildcard(): boolean {
        return this.product === ProductCode.Any || !this.type || !this.specific;
    }

    /**
     * Converts platform to string key format.
     * Result is cached for performance.
     *
     * @returns String key (e.g., 'adg_os_windows', 'adg_any')
     */
    toString(): string {
        // Return cached value if available
        if (this.stringCache !== undefined) {
            return this.stringCache;
        }

        // Compute and cache the string representation
        let result: string;

        if (this.product === ProductCode.Any) {
            result = WILDCARD_ANY;
        } else {
            const parts: string[] = [this.product];

            if (this.type && this.type !== PlatformType.Any) {
                parts.push(this.type);
            } else if (!this.type) {
                result = `${this.product}${PLATFORM_SEPARATOR}${WILDCARD_ANY}`;
                this.stringCache = result;
                return this.stringCache;
            }

            if (this.specific) {
                parts.push(this.specific);
            } else if (this.type && !this.specific) {
                result = `${this.product}${PLATFORM_SEPARATOR}${this.type}${PLATFORM_SEPARATOR}${WILDCARD_ANY}`;
                this.stringCache = result;
                return this.stringCache;
            }

            result = parts.join(PLATFORM_SEPARATOR);
        }

        this.stringCache = result;
        return this.stringCache;
    }

    /**
     * Converts platform to path array for trie navigation.
     * Result is cached for performance.
     *
     * @returns Path array (e.g., ['adg', 'os', 'windows'])
     */
    toPath(): string[] {
        // Return cached value if available
        if (this.pathCache !== undefined) {
            return this.pathCache;
        }

        // Compute and cache the path
        const path: string[] = [];

        if (this.product === ProductCode.Any) {
            path.push(WILDCARD_ANY);
        } else {
            path.push(this.product);

            if (this.type) {
                path.push(this.type);
            }

            if (this.specific) {
                path.push(this.specific);
            }
        }

        this.pathCache = path;
        return path;
    }

    /**
     * Checks if this platform matches another platform.
     * Wildcards match their children.
     *
     * @param target Platform to check against.
     * @returns True if this platform matches the target.
     */
    matches(target: Platform): boolean {
        // 'any' matches everything
        if (this.product === ProductCode.Any) {
            return true;
        }

        // Product must match
        if (this.product !== target.product) {
            return false;
        }

        // If we don't specify type, we match all types
        if (!this.type) {
            return true;
        }

        // Type must match
        if (this.type !== target.type) {
            return false;
        }

        // If we don't specify specific, we match all specifics
        if (!this.specific) {
            return true;
        }

        // Specific must match
        return this.specific === target.specific;
    }

    /**
     * Checks if this platform is for a specific product.
     *
     * @param product Product code to check.
     * @returns True if platform is for this product.
     */
    isProduct(product: ProductCode): boolean {
        return this.product === product || this.product === ProductCode.Any;
    }

    /**
     * Gets a human-readable name for this platform.
     *
     * @returns Human-readable platform name.
     */
    toHumanReadable(): string {
        if (this.product === ProductCode.Any) {
            return 'Any product';
        }

        // Map product code to human-readable name
        const productNames: Record<ProductCode, string> = {
            [ProductCode.Adg]: 'AdGuard',
            [ProductCode.Ubo]: 'uBlock Origin',
            [ProductCode.Abp]: 'Adblock Plus',
            [ProductCode.Any]: 'Any product',
        };

        const productName = productNames[this.product];

        if (!this.type) {
            return `Any ${productName} product`;
        }

        const typeNames: Record<PlatformType, string> = {
            [PlatformType.Os]: 'System-level App',
            [PlatformType.Cb]: 'Content Blocker',
            [PlatformType.Ext]: 'Browser Extension',
            [PlatformType.Safari]: 'Safari Content Blocker',
            [PlatformType.Any]: 'Any platform',
        };

        const typeName = typeNames[this.type] || this.type;

        if (!this.specific) {
            return `Any ${productName} ${typeName}`;
        }

        const specificDisplayNames: Record<PlatformSpecific, string> = {
            [PlatformSpecific.Windows]: 'Windows',
            [PlatformSpecific.Linux]: 'Linux',
            [PlatformSpecific.Mac]: 'macOS',
            [PlatformSpecific.Android]: 'Android',
            [PlatformSpecific.Ios]: 'iOS',
            [PlatformSpecific.Safari]: 'Safari',
            [PlatformSpecific.Chrome]: 'Chrome',
            [PlatformSpecific.Opera]: 'Opera',
            [PlatformSpecific.Edge]: 'Edge',
            [PlatformSpecific.Firefox]: 'Firefox',
            [PlatformSpecific.ChromeMv3]: 'Chrome MV3',
            [PlatformSpecific.OperaMv3]: 'Opera MV3',
            [PlatformSpecific.EdgeMv3]: 'Edge MV3',
            [PlatformSpecific.FirefoxMv3]: 'Firefox MV3',
        };
        const specificName = specificDisplayNames[this.specific];

        return `${productName} ${typeName} for ${specificName}`;
    }

    /**
     * Parses a platform string into a Platform object.
     *
     * @param str Platform string (e.g., 'adg_os_windows', 'ubo_ext_chrome').
     * @returns Platform object.
     * @throws Error if platform string is invalid.
     */
    static parse(str: string): Platform {
        const platformStr = str.trim();

        if (platformStr === WILDCARD_ANY) {
            return new Platform(ProductCode.Any);
        }

        const parts = platformStr.split(PLATFORM_SEPARATOR);

        if (parts.length < 1) {
            throw new Error(`Invalid platform string: ${str}`);
        }

        const product = parts[0] as SpecificProductCode;

        // Validate product code
        if (!getValidProductCodes().has(product)) {
            throw new Error(`Invalid product code: ${product}`);
        }

        if (parts.length === 1) {
            throw new Error(`Invalid platform string (missing parts): ${str}`);
        }

        // Handle generic platforms like 'adg_any'
        if (parts.length === 2 && parts[1] === WILDCARD_ANY) {
            return new Platform(product);
        }

        const type = parts[1] as SpecificPlatformType;

        // Validate platform type
        if (!getValidPlatformTypes().has(type)) {
            throw new Error(`Invalid platform type: ${type}`);
        }

        // Handle 'adg_os_any' style
        if (parts.length === 3 && parts[2] === WILDCARD_ANY) {
            return new Platform(product, type);
        }

        // Specific platform: join remaining parts (e.g., 'chrome_mv3')
        const specific = parts.slice(2).join(PLATFORM_SEPARATOR) as PlatformSpecific;

        // Validate specific platform
        if (!getValidPlatformSpecifics().has(specific)) {
            throw new Error(`Invalid platform specific: ${specific}`);
        }

        return new Platform(product, type, specific);
    }

    /**
     * Gets all concrete (non-wildcard) platforms.
     * Used for wildcard expansion.
     *
     * @returns Array of all specific platform instances.
     */
    static getAllConcretePlatforms(): Platform[] {
        if (Platform.concretePlatformsCache === null) {
            const platforms: Platform[] = [];

            // Iterate over all static properties of the Platform class
            for (const key of Object.getOwnPropertyNames(Platform)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const value = (Platform as any)[key];

                // Check if it's a Platform instance and not a wildcard
                if (value instanceof Platform && !value.isWildcard) {
                    platforms.push(value);
                }
            }

            // Sort for consistent ordering
            Platform.concretePlatformsCache = platforms.sort(
                (a, b) => a.toString().localeCompare(b.toString()),
            );
        }

        return Platform.concretePlatformsCache;
    }

    static readonly AdgOsWindows = new Platform(ProductCode.Adg, PlatformType.Os, PlatformSpecific.Windows);

    static readonly AdgOsLinux = new Platform(ProductCode.Adg, PlatformType.Os, PlatformSpecific.Linux);

    static readonly AdgOsMac = new Platform(ProductCode.Adg, PlatformType.Os, PlatformSpecific.Mac);

    static readonly AdgOsAndroid = new Platform(ProductCode.Adg, PlatformType.Os, PlatformSpecific.Android);

    static readonly AdgExtChrome = new Platform(ProductCode.Adg, PlatformType.Ext, PlatformSpecific.Chrome);

    static readonly AdgExtOpera = new Platform(ProductCode.Adg, PlatformType.Ext, PlatformSpecific.Opera);

    static readonly AdgExtEdge = new Platform(ProductCode.Adg, PlatformType.Ext, PlatformSpecific.Edge);

    static readonly AdgExtFirefox = new Platform(ProductCode.Adg, PlatformType.Ext, PlatformSpecific.Firefox);

    static readonly AdgExtChromeMv3 = new Platform(ProductCode.Adg, PlatformType.Ext, PlatformSpecific.ChromeMv3);

    static readonly AdgExtOperaMv3 = new Platform(ProductCode.Adg, PlatformType.Ext, PlatformSpecific.OperaMv3);

    static readonly AdgExtEdgeMv3 = new Platform(ProductCode.Adg, PlatformType.Ext, PlatformSpecific.EdgeMv3);

    static readonly AdgExtFirefoxMv3 = new Platform(ProductCode.Adg, PlatformType.Ext, PlatformSpecific.FirefoxMv3);

    static readonly AdgCbAndroid = new Platform(ProductCode.Adg, PlatformType.Cb, PlatformSpecific.Android);

    static readonly AdgCbIos = new Platform(ProductCode.Adg, PlatformType.Cb, PlatformSpecific.Ios);

    static readonly AdgCbSafari = new Platform(ProductCode.Adg, PlatformType.Cb, PlatformSpecific.Safari);

    static readonly UboExtChrome = new Platform(ProductCode.Ubo, PlatformType.Ext, PlatformSpecific.Chrome);

    static readonly UboExtOpera = new Platform(ProductCode.Ubo, PlatformType.Ext, PlatformSpecific.Opera);

    static readonly UboExtEdge = new Platform(ProductCode.Ubo, PlatformType.Ext, PlatformSpecific.Edge);

    static readonly UboExtFirefox = new Platform(ProductCode.Ubo, PlatformType.Ext, PlatformSpecific.Firefox);

    static readonly UboExtChromeMv3 = new Platform(ProductCode.Ubo, PlatformType.Ext, PlatformSpecific.ChromeMv3);

    static readonly UboExtOperaMv3 = new Platform(ProductCode.Ubo, PlatformType.Ext, PlatformSpecific.OperaMv3);

    static readonly UboExtEdgeMv3 = new Platform(ProductCode.Ubo, PlatformType.Ext, PlatformSpecific.EdgeMv3);

    static readonly UboExtFirefoxMv3 = new Platform(ProductCode.Ubo, PlatformType.Ext, PlatformSpecific.FirefoxMv3);

    static readonly AbpExtChrome = new Platform(ProductCode.Abp, PlatformType.Ext, PlatformSpecific.Chrome);

    static readonly AbpExtOpera = new Platform(ProductCode.Abp, PlatformType.Ext, PlatformSpecific.Opera);

    static readonly AbpExtEdge = new Platform(ProductCode.Abp, PlatformType.Ext, PlatformSpecific.Edge);

    static readonly AbpExtFirefox = new Platform(ProductCode.Abp, PlatformType.Ext, PlatformSpecific.Firefox);

    static readonly AbpExtChromeMv3 = new Platform(ProductCode.Abp, PlatformType.Ext, PlatformSpecific.ChromeMv3);

    static readonly AbpExtOperaMv3 = new Platform(ProductCode.Abp, PlatformType.Ext, PlatformSpecific.OperaMv3);

    static readonly AbpExtEdgeMv3 = new Platform(ProductCode.Abp, PlatformType.Ext, PlatformSpecific.EdgeMv3);

    static readonly AbpExtFirefoxMv3 = new Platform(ProductCode.Abp, PlatformType.Ext, PlatformSpecific.FirefoxMv3);

    // ===== Generic Platforms (Wildcards) =====

    static readonly AdgOsAny = new Platform(ProductCode.Adg, PlatformType.Os);

    static readonly AdgCbAny = new Platform(ProductCode.Adg, PlatformType.Cb);

    static readonly AdgExtAny = new Platform(ProductCode.Adg, PlatformType.Ext);

    static readonly AdgAny = new Platform(ProductCode.Adg);

    static readonly UboExtAny = new Platform(ProductCode.Ubo, PlatformType.Ext);

    static readonly UboAny = new Platform(ProductCode.Ubo);

    static readonly AbpExtAny = new Platform(ProductCode.Abp, PlatformType.Ext);

    static readonly AbpAny = new Platform(ProductCode.Abp);

    static readonly Any = new Platform(ProductCode.Any);
}
