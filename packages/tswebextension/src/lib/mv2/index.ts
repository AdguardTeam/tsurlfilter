export * from './background';
export * from './content-script';

// Needed to print libraries version in extension popup.
// NOTE: Do not export anything from extended-css in MV3 environment to prevent
// environment runtime errors, like call window.console, which is not available
// in the service worker in MV3.
export { EXTENDED_CSS_VERSION } from '@adguard/extended-css';
