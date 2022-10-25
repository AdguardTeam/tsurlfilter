// WICG Spec: https://wicg.github.io/ua-client-hints
// https://wicg.github.io/ua-client-hints/#navigatorua
declare global {
    interface Navigator {
        readonly userAgentData?: NavigatorUAData;
    }
}

// https://wicg.github.io/ua-client-hints/#dictdef-navigatoruabrandversion
interface NavigatorUABrandVersion {
    readonly brand: string;
    readonly version: string;
}

// https://wicg.github.io/ua-client-hints/#dictdef-uadatavalues
interface UADataValues {
    readonly brands?: NavigatorUABrandVersion[];
    readonly mobile?: boolean;
    readonly platform?: string;
    readonly architecture?: string;
    readonly bitness?: string;
    readonly model?: string;
    readonly platformVersion?: string;
    /** @deprecated in favour of fullVersionList */
    readonly uaFullVersion?: string;
    readonly fullVersionList?: NavigatorUABrandVersion[];
    readonly wow64?: boolean;
}

// https://wicg.github.io/ua-client-hints/#dictdef-ualowentropyjson
interface UALowEntropyJSON {
    readonly brands: NavigatorUABrandVersion[];
    readonly mobile: boolean;
    readonly platform: string;
}

// https://wicg.github.io/ua-client-hints/#navigatoruadata
interface NavigatorUAData extends UALowEntropyJSON {
    getHighEntropyValues(hints: string[]): Promise<UADataValues>;
    toJSON(): UALowEntropyJSON;
}

type BrowserData = {
    uaStringName: string;
    brand?: string;
};

/**
 * helper class for user agent data
 */
export class UserAgent {
    private static browserDataMap: Record<string, BrowserData> = {
        Chrome: {
            brand: "Google Chrome",
            uaStringName: "Chrome",
        },
        Firefox: {
            uaStringName: "Firefox",
        },
        Safari: {
            uaStringName: "Safari",
        },
        Opera: {
            brand: "Opera",
            uaStringName: "OPR",
        },
        YaBrowser: {
            brand: "Yandex",
            uaStringName: "YaBrowser",
        },
        Edge: {
            uaStringName: "edge",
        },
        EdgeChromium: {
            brand: "Microsoft Edge",
            uaStringName: "edg",
        },
    };

    public static isChrome = UserAgent.isTargetBrowser("Chrome");

    public static isFirefox = UserAgent.isTargetBrowser("Firefox");

    public static isOpera = UserAgent.isTargetBrowser("Opera");

    public static isEdge = UserAgent.isTargetBrowser("Edge");

    /**
     * Check if current browser is as given
     *
     * @param browserName - Browser Name
     * @returns true, if current browser has specified name
     */
    private static isTargetBrowser(browserName: string): boolean {
        const brand = UserAgent.browserDataMap[browserName]?.brand;
        const uaStringName = UserAgent.browserDataMap[browserName]?.uaStringName;

        const brandsData = navigator?.userAgentData?.brands;

        if (!brandsData || !brand) {
            return navigator.userAgent.indexOf(uaStringName) >= 0;
        }

        for (let i = 0; i < brandsData.length; i += 1) {
            const data = brandsData[i];

            if (data.brand === brand) {
                return true;
            }
        }

        return false;
    }
}
