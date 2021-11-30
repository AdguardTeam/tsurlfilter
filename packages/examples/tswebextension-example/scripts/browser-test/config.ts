import path from "path";
import { Configuration } from "@adguard/tswebextension";

export const baseUrl = 'https://testcases.adguard.com';

export const pathToExtension = path.join(__dirname, "../../build");

export const defaultExtensionConfig: Configuration = {
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