const path = require("path");

module.exports = {
    baseUrl: 'https://testcases.adguard.com',
    pathToExtension: path.join(__dirname, "../build"),
    defaultExtensionConfig: {
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
}