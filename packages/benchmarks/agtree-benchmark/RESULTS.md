# Benchmark results

## Environment

- Date: Thu, 13 Jun 2024 14:24:31 GMT
- Node.js version: v20.13.1
- OS: Linux 5.15

> [!NOTE]
> Results are sorted by performance (fastest first).

<!--markdownlint-disable MD013-->
## AdGuard Base List

|                                                            Tool                                                            |    ops/sec    | Runs sampled |   Average runtime  | Processed rules |   Status  |
| :------------------------------------------------------------------------------------------------------------------------: | :-----------: | :----------: | :----------------: | :-------------: | :-------: |
|            [@adguard/agtree v2 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 4.23 (±5.90%) |      16      |  236.1527558125 ms |      122847     | no errors |
| [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 3.51 (±3.58%) |      13      |  284.5360981538 ms |      123446     | no errors |
| [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 3.51 (±3.76%) |      13      |  284.9554656923 ms |      122843     | no errors |
|            [@adguard/agtree v1 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 2.42 (±6.16%) |      10      |  413.7739712000 ms |      122847     | no errors |
|      [@adguard/agtree v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 1.72 (±7.45%) |       9      |  580.5367927778 ms |      122847     | no errors |
|      [@adguard/agtree v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 0.71 (±7.05%) |       6      | 1417.7992008333 ms |      122847     | no errors |

## AdGuard Annoyances Filter

|                                                            Tool                                                            |    ops/sec    | Runs sampled |  Average runtime  | Processed rules |   Status  |
| :------------------------------------------------------------------------------------------------------------------------: | :-----------: | :----------: | :---------------: | :-------------: | :-------: |
| [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 7.44 (±1.77%) |      23      | 134.3745148261 ms |      47720      | no errors |
| [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 7.41 (±2.56%) |      23      | 134.9176940435 ms |      47714      | no errors |
|            [@adguard/agtree v2 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 5.87 (±5.13%) |      19      | 170.5024830000 ms |      47720      | no errors |
|      [@adguard/agtree v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 3.63 (±5.59%) |      14      | 275.8097956429 ms |      47720      | no errors |
|            [@adguard/agtree v1 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 3.20 (±2.81%) |      12      | 312.4363049167 ms |      47720      | no errors |
|      [@adguard/agtree v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 1.04 (±5.38%) |       7      | 957.3148612857 ms |      47720      | no errors |

## AdGuard Mobile Ads Filter

|                                                            Tool                                                            |     ops/sec    | Runs sampled |  Average runtime  | Processed rules |   Status  |
| :------------------------------------------------------------------------------------------------------------------------: | :------------: | :----------: | :---------------: | :-------------: | :-------: |
| [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 63.49 (±1.08%) |      67      |  15.7513535597 ms |       7032      | no errors |
|            [@adguard/agtree v2 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 51.91 (±3.16%) |      55      |  19.2644355379 ms |       7034      | no errors |
| [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 50.53 (±0.90%) |      66      |  19.7908455657 ms |       7034      | no errors |
|      [@adguard/agtree v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 29.16 (±2.79%) |      52      |  34.2893600385 ms |       7034      | no errors |
|            [@adguard/agtree v1 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 25.80 (±2.56%) |      47      |  38.7645089681 ms |       7034      | no errors |
|      [@adguard/agtree v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      |  7.93 (±3.32%) |      24      | 126.1210967500 ms |       7034      | no errors |

## uBlock Base List

|                                                            Tool                                                            |     ops/sec    | Runs sampled |  Average runtime  | Processed rules |   Status  |
| :------------------------------------------------------------------------------------------------------------------------: | :------------: | :----------: | :---------------: | :-------------: | :-------: |
|            [@adguard/agtree v2 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 27.60 (±2.28%) |      51      |  36.2300315784 ms |      11173      | no errors |
| [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 26.49 (±1.06%) |      48      |  37.7447089688 ms |      11204      | no errors |
| [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 23.16 (±1.42%) |      43      |  43.1801831047 ms |      11168      | no errors |
|            [@adguard/agtree v1 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 21.17 (±3.33%) |      40      |  47.2268794375 ms |      11173      | no errors |
|      [@adguard/agtree v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 16.47 (±2.46%) |      45      |  60.7018958667 ms |      11173      | no errors |
|      [@adguard/agtree v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      |  8.49 (±3.74%) |      26      | 117.8028340385 ms |      11173      | no errors |

## EasyList

|                                                            Tool                                                            |     ops/sec    | Runs sampled |  Average runtime  | Processed rules |   Status  |
| :------------------------------------------------------------------------------------------------------------------------: | :------------: | :----------: | :---------------: | :-------------: | :-------: |
|            [@adguard/agtree v2 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 10.98 (±4.01%) |      31      |  91.0414494194 ms |      73413      | no errors |
| [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) |  9.61 (±1.25%) |      28      | 104.0317523214 ms |      73413      | no errors |
| [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) |  9.49 (±1.43%) |      28      | 105.4164031429 ms |      73413      | no errors |
|            [@adguard/agtree v1 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           |  7.40 (±4.39%) |      23      | 135.0795113043 ms |      73413      | no errors |
|      [@adguard/agtree v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      |  4.17 (±2.42%) |      15      | 239.8171682000 ms |      73413      | no errors |
|      [@adguard/agtree v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      |  1.91 (±5.51%) |       9      | 523.9055340000 ms |      73413      | no errors |

<!--markdownlint-enable MD013-->
