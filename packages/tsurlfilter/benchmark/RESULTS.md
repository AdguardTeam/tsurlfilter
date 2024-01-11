# Benchmark results

## Environment

- Date: Thu, 11 Jan 2024 11:42:32 GMT
- Node.js version: v18.17.1
- OS: Linux 5.15

> [!NOTE]
> Results are sorted by performance (fastest first).

<!--markdownlint-disable MD013-->
## AdGuard Base List

|                                                               Tool                                                              |    ops/sec    | Runs sampled |  Average runtime  | Processed rules |   Status  |
| :-----------------------------------------------------------------------------------------------------------------------------: | :-----------: | :----------: | :---------------: | :-------------: | :-------: |
|    [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter)   | 3.68 (±0.60%) |      14      | 271.5998002143 ms |      115963     | no errors |
|    [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter)   | 3.62 (±1.02%) |      14      | 276.1780970714 ms |      117143     | no errors |
| [@adguard/tsurlfilter current - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 1.19 (±0.54%) |       7      | 838.7494174286 ms |      115963     | no errors |

## AdGuard Annoyances Filter

|                                                               Tool                                                              |    ops/sec    | Runs sampled |  Average runtime  | Processed rules |   Status  |
| :-----------------------------------------------------------------------------------------------------------------------------: | :-----------: | :----------: | :---------------: | :-------------: | :-------: |
|    [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter)   | 8.11 (±0.36%) |      25      | 123.3166844800 ms |      45821      | no errors |
|    [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter)   | 7.40 (±0.76%) |      23      | 135.0896451304 ms |      45822      | no errors |
| [@adguard/tsurlfilter current - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 1.88 (±0.84%) |       9      | 530.7155938889 ms |      45822      | no errors |

## AdGuard Mobile Ads Filter

|                                                               Tool                                                              |     ops/sec    | Runs sampled |  Average runtime | Processed rules |   Status  |
| :-----------------------------------------------------------------------------------------------------------------------------: | :------------: | :----------: | :--------------: | :-------------: | :-------: |
|    [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter)   | 62.30 (±0.49%) |      66      | 16.0503315530 ms |       6707      | no errors |
|    [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter)   | 48.08 (±0.24%) |      64      | 20.7980834115 ms |       6709      | no errors |
| [@adguard/tsurlfilter current - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 15.49 (±1.12%) |      43      | 64.5588703488 ms |       6709      | no errors |

## uBlock Base List

|                                                               Tool                                                              |     ops/sec    | Runs sampled |  Average runtime  | Processed rules |   Status  |
| :-----------------------------------------------------------------------------------------------------------------------------: | :------------: | :----------: | :---------------: | :-------------: | :-------: |
|    [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter)   | 22.65 (±0.66%) |      42      |  44.1527963571 ms |      11814      | no errors |
|    [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter)   | 19.29 (±1.47%) |      44      |  51.8456243068 ms |      11778      | no errors |
| [@adguard/tsurlfilter current - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) |  7.74 (±0.57%) |      24      | 129.1276041250 ms |      11778      | no errors |

## EasyList

|                                                               Tool                                                              |     ops/sec    | Runs sampled |  Average runtime  | Processed rules |   Status  |
| :-----------------------------------------------------------------------------------------------------------------------------: | :------------: | :----------: | :---------------: | :-------------: | :-------: |
|    [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter)   | 10.37 (±0.33%) |      30      |  96.4329859333 ms |      66633      | no errors |
|    [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter)   |  9.75 (±1.09%) |      29      | 102.5910066897 ms |      66633      | no errors |
| [@adguard/tsurlfilter current - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) |  3.23 (±0.61%) |      13      | 309.3275096923 ms |      66633      | no errors |

<!--markdownlint-enable MD013-->
