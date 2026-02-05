/**
 * @file Platform class for hierarchical platform representation.
 * Replaces bitwise platform enums with a clean, hierarchical structure.
 */

import { AdblockProduct } from '../utils/adblockers';

/**
 * Product identifiers (short codes).
 */
export type ProductCode = 'adg' | 'ubo' | 'abp' | 'any';

/**
 * Platform type identifiers.
 */
export type PlatformType = 'os' | 'cb' | 'ext' | 'any';

/**
 * Wildcard identifier for 'any' platform.
 */
const WILDCARD_ANY = 'any';

/**
 * Separator for platform string representation.
 */
const PLATFORM_SEPARATOR = '_';

/**
 * Mapping from product codes to AdblockProduct enum.
 */
const PRODUCT_CODE_TO_ENUM: Record<ProductCode, AdblockProduct | 'any'> = {
    adg: AdblockProduct.Adg,
    ubo: AdblockProduct.Ubo,
    abp: AdblockProduct.Abp,
    any: WILDCARD_ANY,
};

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
    public readonly specific?: string;

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
    constructor(product: ProductCode, type?: PlatformType, specific?: string) {
        this.product = product;
        this.type = type;
        this.specific = specific;
    }

    /**
     * Gets the AdblockProduct enum for this platform.
     *
     * @returns AdblockProduct enum or 'any'.
     */
    getProductEnum(): AdblockProduct | 'any' {
        return PRODUCT_CODE_TO_ENUM[this.product];
    }

    /**
     * Checks if this is a wildcard query (matches multiple platforms).
     *
     * @returns True if this is a wildcard query.
     */
    get isWildcard(): boolean {
        return this.product === WILDCARD_ANY || !this.type || !this.specific;
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

        if (this.product === WILDCARD_ANY) {
            result = WILDCARD_ANY;
        } else {
            const parts: string[] = [this.product];

            if (this.type && this.type !== WILDCARD_ANY) {
                parts.push(this.type);
            } else if (!this.type) {
                result = `${this.product}${PLATFORM_SEPARATOR}${WILDCARD_ANY}`;
                this.stringCache = result;
                return this.stringCache;
            }

            if (this.specific && this.specific !== WILDCARD_ANY) {
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

        if (this.product === WILDCARD_ANY) {
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
        if (this.product === WILDCARD_ANY) {
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
        return this.product === product || this.product === WILDCARD_ANY;
    }

    /**
     * Gets a human-readable name for this platform.
     *
     * @returns Human-readable platform name.
     */
    toHumanReadable(): string {
        if (this.product === WILDCARD_ANY) {
            return 'Any product';
        }

        // Map product code to human-readable name
        const productNames: Record<ProductCode, string> = {
            adg: 'AdGuard',
            ubo: 'uBlock Origin',
            abp: 'Adblock Plus',
            any: 'Any product',
        };

        const productName = productNames[this.product];

        if (!this.type) {
            return `Any ${productName} product`;
        }

        const typeNames: Record<string, string> = {
            os: 'System-level App',
            cb: 'Content Blocker',
            ext: 'Browser Extension',
            any: 'Any platform',
        };

        const typeName = typeNames[this.type] || this.type;

        if (!this.specific) {
            return `Any ${productName} ${typeName}`;
        }

        // Capitalize specific platform name
        const specificName = this.specific.charAt(0).toUpperCase() + this.specific.slice(1);

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
            return new Platform(WILDCARD_ANY);
        }

        const parts = platformStr.split(PLATFORM_SEPARATOR);

        if (parts.length < 1) {
            throw new Error(`Invalid platform string: ${str}`);
        }

        const product = parts[0] as ProductCode;

        // Validate product code
        if (product !== 'adg' && product !== 'ubo' && product !== 'abp') {
            throw new Error(`Invalid product code: ${product}`);
        }

        if (parts.length === 1) {
            throw new Error(`Invalid platform string (missing parts): ${str}`);
        }

        // Handle generic platforms like 'adg_any'
        if (parts.length === 2 && parts[1] === WILDCARD_ANY) {
            return new Platform(product);
        }

        const type = parts[1] as PlatformType;

        // Handle 'adg_os_any' style
        if (parts.length === 3 && parts[2] === WILDCARD_ANY) {
            return new Platform(product, type);
        }

        // Specific platform: join remaining parts (e.g., 'chrome_mv3')
        const specific = parts.slice(2).join(PLATFORM_SEPARATOR);

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

    static readonly AdgOsWindows = new Platform('adg', 'os', 'windows');

    static readonly AdgOsLinux = new Platform('adg', 'os', 'linux');

    static readonly AdgOsMac = new Platform('adg', 'os', 'mac');

    static readonly AdgOsAndroid = new Platform('adg', 'os', 'android');

    static readonly AdgExtChrome = new Platform('adg', 'ext', 'chrome');

    static readonly AdgExtOpera = new Platform('adg', 'ext', 'opera');

    static readonly AdgExtEdge = new Platform('adg', 'ext', 'edge');

    static readonly AdgExtFirefox = new Platform('adg', 'ext', 'firefox');

    static readonly AdgExtChromeMv3 = new Platform('adg', 'ext', 'chrome_mv3');

    static readonly AdgExtOperaMv3 = new Platform('adg', 'ext', 'opera_mv3');

    static readonly AdgExtEdgeMv3 = new Platform('adg', 'ext', 'edge_mv3');

    static readonly AdgExtFirefoxMv3 = new Platform('adg', 'ext', 'firefox_mv3');

    static readonly AdgCbAndroid = new Platform('adg', 'cb', 'android');

    static readonly AdgCbIos = new Platform('adg', 'cb', 'ios');

    static readonly AdgCbSafari = new Platform('adg', 'cb', 'safari');

    static readonly UboExtChrome = new Platform('ubo', 'ext', 'chrome');

    static readonly UboExtOpera = new Platform('ubo', 'ext', 'opera');

    static readonly UboExtEdge = new Platform('ubo', 'ext', 'edge');

    static readonly UboExtFirefox = new Platform('ubo', 'ext', 'firefox');

    static readonly UboExtChromeMv3 = new Platform('ubo', 'ext', 'chrome_mv3');

    static readonly UboExtOperaMv3 = new Platform('ubo', 'ext', 'opera_mv3');

    static readonly UboExtEdgeMv3 = new Platform('ubo', 'ext', 'edge_mv3');

    static readonly UboExtFirefoxMv3 = new Platform('ubo', 'ext', 'firefox_mv3');

    static readonly AbpExtChrome = new Platform('abp', 'ext', 'chrome');

    static readonly AbpExtOpera = new Platform('abp', 'ext', 'opera');

    static readonly AbpExtEdge = new Platform('abp', 'ext', 'edge');

    static readonly AbpExtFirefox = new Platform('abp', 'ext', 'firefox');

    static readonly AbpExtChromeMv3 = new Platform('abp', 'ext', 'chrome_mv3');

    static readonly AbpExtOperaMv3 = new Platform('abp', 'ext', 'opera_mv3');

    static readonly AbpExtEdgeMv3 = new Platform('abp', 'ext', 'edge_mv3');

    static readonly AbpExtFirefoxMv3 = new Platform('abp', 'ext', 'firefox_mv3');

    // ===== Generic Platforms (Wildcards) =====

    static readonly AdgOsAny = new Platform('adg', 'os');

    static readonly AdgCbAny = new Platform('adg', 'cb');

    static readonly AdgExtAny = new Platform('adg', 'ext');

    static readonly AdgAny = new Platform('adg');

    static readonly UboExtAny = new Platform('ubo', 'ext');

    static readonly UboAny = new Platform('ubo');

    static readonly AbpExtAny = new Platform('abp', 'ext');

    static readonly AbpAny = new Platform('abp');

    static readonly Any = new Platform('any');
}
