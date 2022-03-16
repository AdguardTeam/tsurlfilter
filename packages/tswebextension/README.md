# TSWebExtension

TypeScript library that wraps webextension api for tsurlfilter library.

Table of content:

- [TSWebExtension](#tswebextension)
  - [Browser support](#browser-support)
  - [Install](#install)
  - [Usage](#usage)
  - [Api](#api)
    - [CLI Api](#cli-api)
    - [Background common Api](#background-common-api)
    - [Background manifest v2 Api](#background-manifest-v2-api)
    - [Configuration](#configuration)
  - [Development](#development)

## Browser support

|                |manifest v2   |manifest v3  |
|----------------|--------------|-------------|
| Chrome         | ✅           | 🚧
| Firefox        | ✅           | 🚧

## Install

```sh
yarn add @adguard/tswebextension
```
## Usage

You can find examples in `packages/examples/tswebextension-*`


**Note:**

Before running compiled app, load the web accessible resources for redirect rules

via built-in cli:

```sh
 tswebextension war [path]
```

or intergrate loading in your build pipeline:

```ts
import { copyWar, DEFAULT_WAR_PATH } from '@adguard/tswebextension/cli';

const build = async () => {
  ...
  await copyWar(DEFAULT_WAR_PATH);
  ...
};
```

If path is not defined, the resources will be loaded to `build/war` relative to your current working directory by default


## Api
### CLI Api

```
Usage: tswebextension-utils [options] [command]

CLI to some development utils

Options:
  -V, --version   output the version number
  -h, --help      display help for command

Commands:
  war [path]      Downloads web accessible resources for
                  redirect rules
  help [command]  display help for command
```

### Background common Api

```ts
// source: src/lib/common/app.ts

export interface AppInterface {

    /**
     * Is app started
     */
    isStarted: boolean;

    /**
     * Current Configuration object
     */
    configuration?: Configuration;

    /**
     * Fires on filtering log event
     */
    onFilteringLogEvent: EventChannelInterface<FilteringLogEvent>,

    /**
     * Starts api
     * @param configuration
     */
    start: (configuration: Configuration) => Promise<void>;

    /**
     * Stops api
     */
    stop: () => Promise<void>;

    /**
     * Updates configuration
     * @param configuration
     */
    configure: (configuration: Configuration) => Promise<void>;

    /**
     * Launches assistant in the current tab
     */
    openAssistant: (tabId: number) => void;

    /**
     * Closes assistant
     */
    closeAssistant: (tabId: number) => void;

    /**
     * Returns current status for site
     */
    getSiteStatus(url: string): SiteStatus,

    /**
     * Returns number of active rules
     */
    getRulesCount(): number,
}
```

### Background manifest v2 Api

```ts
  // source: src/lib/mv2/background/app.ts

  export interface ManifestV2AppInterface extends AppInterface {
      getMessageHandler: () => typeof messagesApi.handleMessage
  }
```

### Configuration
```ts
// source: src/lib/common/configuration.ts

type Configuration = {
    /**
     * Specifies filter lists that will be used to filter content.
     * filterId should uniquely identify the filter so that the API user
     * may match it with the source lists in the filtering log callbacks.
     * content is a string with the full filter list content. The API will
     * parse it into a list of individual rules.
     */
    filters: {
        filterId: number;
        content: string;
    }[];
    /**
     * List of domain names of sites, which should be excluded from blocking
     * or which should be included in blocking depending on the value of
     * allowlistInverted setting value
     */
    allowlist: string[];
    /**
     * List of rules added by user
     */
    userrules: string[];
    /**
     * Flag responsible for logging
     */
    verbose: boolean;
    settings: {
        /**
         * Flag specifying if ads for sites would be blocked or allowed
         */
        allowlistInverted: boolean;
        /**
         * Enables css hits counter if true
         */
        collectStats: boolean;
        stealth: {
            blockChromeClientData: boolean;
            hideReferrer: boolean;
            hideSearchQueries: boolean;
            sendDoNotTrack: boolean;
            blockWebRTC: boolean;
            selfDestructThirdPartyCookies: boolean;
            selfDestructThirdPartyCookiesTime: number;
            selfDestructFirstPartyCookies: boolean;
            selfDestructFirstPartyCookiesTime: number;
        };
    };
}
```

## Development

run module tests

```sh
yarn test
```

run build

```sh
yarn build
```

lint source code

```
yarn lint
```
