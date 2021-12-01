import path from "path";
import { Configuration } from "@adguard/tswebextension";

export const BASE_URL = 'https://testcases.adguard.com';

export const TESTCASES_DATA_PATH = '/data.json';

export const EXTENSION_PATH = path.join(__dirname, "../../build");

export const DEFAULT_EXTENSION_CONFIG: Configuration = {
    filters: [],
    allowlist: [],
    userrules: [],
    verbose: false,
    settings: {
        collectStats: true,
        allowlistInverted: false,
        stealth: {
            blockChromeClientData: true,
            hideReferrer: true,
            hideSearchQueries: true,
            sendDoNotTrack: true,
            blockWebRTC: true,
            selfDestructThirdPartyCookies: true,
            selfDestructThirdPartyCookiesTime: 3600,
            selfDestructFirstPartyCookies: true,
            selfDestructFirstPartyCookiesTime: 3600,
        },
    },
}