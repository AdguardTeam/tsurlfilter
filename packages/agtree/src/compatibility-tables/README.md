# Compatibility tables

This directory contains compatibility tables for various adblock rule features.

## Supported categories

Currently, the following categories are supported. Each category has its own compatibility table:

- Modifiers
- Scriptlets
- (Extended) CSS selectors

Please note that certain things, such as syntax or rule categories, cannot be handled by the compatibility table.
This is simply because they rarely change, and would also require a high level of abstraction, so it is much easier
to manage them at a low level, at the parser / converter level. The compatibility table mainly covers features that
are well abstracted and common to several adblockers, just with different implementations. For example, network rule
modifiers or CSS selectors are used by all adblockers, but with different functionality.

## Supported adblockers and platforms

Currently we support the following adblockers:

- <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" width="14px"> AdGuard (`adg`)
- <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" width="14px"> uBlock Origin (`ubo`)
- <img src="https://cdn.adguard.com/website/github.com/AGLint/abp_logo.svg" width="14px"> AdBlock / Adblock Plus (`abp`)

However, there may also be compatibility differences within a brand due to the specificities and limitations of each
platform. For example:

- AdGuard content blockers doesn't support CSS injection, while the AdGuard browser extension does. This is because the
  API of a content blocker does not allow this, while a modern browser extension allows stylesheet injection.
- AdGuard Chrome extension doesn't support HTML filtering, while the Firefox extension does. This is simply because
  Chrome's API does not provide this level of network-level filtering, while Firefox's does.
- etc.

Therefore, we need to specify the platform for each adblocker to cover all the edge cases. The following platforms are
supported:

<!-- markdownlint-disable MD013 -->
| Platform (ID) | Brand | Category |
| --- | --- | --- |
 `adg_os_windows` | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" width="14px"> [AdGuard for Windows](https://adguard.com/adguard-windows/overview.html) | System-wide ad blocker |
`adg_os_mac` | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" width="14px"> [AdGuard for Mac](https://adguard.com/adguard-mac/overview.html) | System-wide ad blocker |
`adg_os_android` | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" width="14px"> [AdGuard for Android](https://adguard.com/adguard-android/overview.html) | System-wide ad blocker |
`adg_ext_chrome` | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" width="14px"> [AdGuard extension for Chrome](https://adguard.com/adguard-browser-extension/chrome/overview.html) | Browser extension |
`adg_ext_opera` | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" width="14px"> [AdGuard extension for Opera](https://adguard.com/adguard-browser-extension/opera/overview.html) | Browser extension |
`adg_ext_edge` | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" width="14px"> [AdGuard extension for Edge](https://adguard.com/adguard-browser-extension/edge/overview.html) | Browser extension |
`adg_ext_firefox` | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" width="14px"> [AdGuard extension for Firefox](https://adguard.com/adguard-browser-extension/firefox/overview.html) | Browser extension |
`adg_cb_android` | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" width="14px"> [AdGuard Content Blocker for Android](https://adguard.com/adguard-content-blocker/overview.html) | Content blocker |
`adg_cb_ios` | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" width="14px"> [AdGuard Content Blocker for iOS](https://adguard.com/adguard-ios/overview.html) | Content blocker |
`adg_cb_safari` | <img src="https://cdn.adguard.com/website/github.com/AGLint/adg_logo.svg" width="14px"> [AdGuard Content Blocker for Safari](https://adguard.com/adguard-safari/overview.html) | Content blocker |
`ubo_ext_chrome` | <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" width="14px"> [uBlock Origin for Google Chrome](https://chrome.google.com/webstore/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm) | Browser extension |
`ubo_ext_firefox` | <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" width="14px"> [uBlock Origin for Mozilla Firefox](https://addons.mozilla.org/addon/ublock-origin/) | Browser extension |
`ubo_ext_opera` | <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" width="14px"> [uBlock Origin for Opera](https://addons.opera.com/extensions/details/ublock/) | Browser extension |
`ubo_ext_edge` | <img src="https://cdn.adguard.com/website/github.com/AGLint/ubo_logo.svg" width="14px"> [uBlock Origin for Microsoft Edge](https://microsoftedge.microsoft.com/addons/detail/ublock-origin/odfafepnkmbhccpbejgmiehpchacaeak) | Browser extension |
`abp_ext_chrome` | <img src="https://cdn.adguard.com/website/github.com/AGLint/abp_logo.svg" width="14px"> [Adblock Plus for Google Chrome](https://chrome.google.com/webstore/detail/cfhdojbkjhnklbpkdaibdccddilifddb) | Browser extension |
`abp_ext_firefox` | <img src="https://cdn.adguard.com/website/github.com/AGLint/abp_logo.svg" width="14px"> [Adblock Plus for Mozilla Firefox](https://eyeo.to/adblockplus/firefox_install/) | Browser extension |
`abp_ext_opera` | <img src="https://cdn.adguard.com/website/github.com/AGLint/abp_logo.svg" width="14px"> [Adblock Plus for Opera](https://eyeo.to/adblockplus/opera_install/) | Browser extension |
`abp_ext_edge` | <img src="https://cdn.adguard.com/website/github.com/AGLint/abp_logo.svg" width="14px"> [Adblock Plus for Microsoft Edge](https://eyeo.to/adblockplus/edge_install/) | Browser extension |
<!-- markdownlint-enable MD013 -->

For simplicity, the following shortcuts are also supported:

<!-- markdownlint-disable MD013 -->
| Shortcut (ID) | Description | Equivalent to (shortcut or platform) |
| --- | --- | --- |
| `any` | Any adblocker, any platform | `adg_any`, `ubo_any`, `abp_any` |
| `adg_any` | Any AdGuard adblocker | `adg_os_any`, `adg_ext_any`, `adg_cb_any` |
| `adg_os_any` | Any AdGuard OS-wide app (using [CoreLibs](https://github.com/AdguardTeam/CoreLibs)) | `adg_os_windows`, `adg_os_mac`, `adg_os_android` |
| `adg_ext_any` | Any AdGuard browser extension | `adg_ext_chromium`, `adg_ext_firefox` |
| `adg_ext_chromium` | AdGuard browser extension for Chromium-based browsers\* | `adg_ext_chrome`, `adg_ext_opera`, `adg_ext_edge` |
| `adg_cb_any` | Any AdGuard content blocker | `adg_cb_android`, `adg_cb_ios`, `adg_cb_safari` |
| `adg_any_not_cb` | Any AdGuard adblocker except content blockers | `adg_os_any`, `adg_ext_any` |
| `ubo_any` | Any uBlock Origin browser extension | `ubo_ext_any` |
| `ubo_ext_any` | Any uBlock Origin browser extension | `ubo_ext_chromium`, `ubo_ext_firefox` |
| `ubo_ext_chromium` | uBlock Origin browser extension for Chromium-based browsers\* | `ubo_ext_chrome`, `ubo_ext_opera`, `ubo_ext_edge` |
| `abp_any` | Any Adblock Plus browser extension | `abp_ext_any` |
| `abp_ext_any` | Any Adblock Plus browser extension | `abp_ext_chromium`, `abp_ext_firefox` |
| `abp_ext_chromium` | Adblock Plus browser extension for Chromium-based browsers\* | `abp_ext_chrome`, `abp_ext_opera`, `abp_ext_edge` |
<!-- markdownlint-enable MD013 -->

\* Chromium-based browsers include Google Chrome, Microsoft Edge, Opera, Brave, Vivaldi, etc. See more details
[here](https://en.wikipedia.org/wiki/Chromium_(web_browser)).
