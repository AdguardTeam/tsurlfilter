/**
 * Stealth action bitwise masks used on the background page and on the filtering log page.
 */
export enum StealthActions {
    None = 0,
    HideReferrer = 1 << 0,
    HideSearchQueries = 1 << 1,
    BlockChromeClientData = 1 << 2,
    SendDoNotTrack = 1 << 3,
    // TODO check where this enums are used, and add comments
    FirstPartyCookies = 1 << 4,
    ThirdPartyCookies = 1 << 5,
}
