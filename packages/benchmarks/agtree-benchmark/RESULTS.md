# Benchmark results

## Environment

- Date: Wed, 23 Apr 2025 08:52:43 GMT
- Node.js version: v22.12.0
- OS: macOS Sequoia

> [!NOTE]
> Results are sorted by performance (fastest first).

<!--markdownlint-disable MD013-->
## AdGuard Base List

|                                                            Tool                                                            |    ops/sec    | Runs sampled |   Average runtime  | Processed rules |   Status  |
| :------------------------------------------------------------------------------------------------------------------------: | :-----------: | :----------: | :----------------: | :-------------: | :-------: |
|            [@adguard/agtree v2 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 8.59 (±6.65%) |      26      |  116.3732243846 ms |      130276     | no errors |
|            [@adguard/agtree v3 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 6.24 (±3.51%) |      20      |  160.2434043000 ms |      130276     | no errors |
|            [@adguard/agtree v1 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 3.36 (±6.11%) |      13      |  297.3725896923 ms |      130276     | no errors |
|      [@adguard/agtree v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 2.69 (±4.48%) |      11      |  372.3476705455 ms |      130276     | no errors |
|      [@adguard/agtree v3 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 2.44 (±3.18%) |      11      |  409.6265340000 ms |      130276     | no errors |
| [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 2.01 (±2.90%) |      10      |  497.2718167000 ms |      130879     | no errors |
|      [@adguard/agtree v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 0.78 (±7.72%) |       6      | 1285.2912153333 ms |      130276     | no errors |
| [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 0.71 (±1.85%) |       6      | 1413.9673335000 ms |      130276     | no errors |

## AdGuard Annoyances Filter

|                                                            Tool                                                            |     ops/sec    | Runs sampled |  Average runtime  | Processed rules |   Status  |
| :------------------------------------------------------------------------------------------------------------------------: | :------------: | :----------: | :---------------: | :-------------: | :-------: |
|            [@adguard/agtree v2 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 14.19 (±2.25%) |      39      |  70.4720267179 ms |      52920      | no errors |
|            [@adguard/agtree v3 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 10.39 (±2.45%) |      30      |  96.2629110000 ms |      52920      | no errors |
| [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) |  4.63 (±2.79%) |      16      | 216.0945810000 ms |      52894      | no errors |
|      [@adguard/agtree v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      |  4.48 (±1.34%) |      16      | 223.1939062500 ms |      52920      | no errors |
|            [@adguard/agtree v1 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           |  4.43 (±3.23%) |      15      | 225.7317722000 ms |      52920      | no errors |
|      [@adguard/agtree v3 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      |  4.03 (±2.24%) |      15      | 248.0192416667 ms |      52920      | no errors |
| [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) |  1.22 (±6.61%) |       7      | 821.0747380000 ms |      52920      | no errors |
|      [@adguard/agtree v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      |  1.16 (±4.04%) |       8      | 858.4310258750 ms |      52920      | no errors |

## AdGuard Mobile Ads Filter

|                                                            Tool                                                            |     ops/sec    | Runs sampled |  Average runtime  | Processed rules |   Status  |
| :------------------------------------------------------------------------------------------------------------------------: | :------------: | :----------: | :---------------: | :-------------: | :-------: |
|            [@adguard/agtree v2 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           |  120 (±1.31%)  |      78      |  8.3392738077 ms  |       7729      | no errors |
|            [@adguard/agtree v3 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 83.59 (±1.38%) |      73      |  11.9631907534 ms |       7729      | no errors |
|      [@adguard/agtree v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 54.42 (±1.94%) |      72      |  18.3741203565 ms |       7729      | no errors |
| [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 50.13 (±0.25%) |      66      |  19.9462178131 ms |       7725      | no errors |
|      [@adguard/agtree v3 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 47.34 (±0.89%) |      63      |  21.1241904709 ms |       7729      | no errors |
|            [@adguard/agtree v1 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 31.64 (±1.40%) |      57      |  31.6055212018 ms |       7729      | no errors |
| [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) |  9.40 (±1.27%) |      28      | 106.3979941071 ms |       7729      | no errors |
|      [@adguard/agtree v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      |  8.09 (±1.26%) |      24      | 123.5844044167 ms |       7729      | no errors |

## uBlock Base List

|                                                            Tool                                                            |     ops/sec    | Runs sampled |   Average runtime   | Processed rules |   Status  |
| :------------------------------------------------------------------------------------------------------------------------: | :------------: | :----------: | :-----------------: | :-------------: | :-------: |
|            [@adguard/agtree v1 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 43.19 (±3.69%) |      57      |   23.1558464737 ms  |       9130      | no errors |
|            [@adguard/agtree v2 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 37.83 (±1.23%) |      67      |   26.4314950373 ms  |       9130      | no errors |
|            [@adguard/agtree v3 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 33.19 (±2.70%) |      60      |   30.1288010333 ms  |       9130      | no errors |
| [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 30.88 (±0.35%) |      55      |   32.3821261455 ms  |       9152      | no errors |
|      [@adguard/agtree v3 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 23.93 (±0.98%) |      44      |   41.7863385455 ms  |       9130      | no errors |
|      [@adguard/agtree v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 23.40 (±4.68%) |      44      |   42.7320279432 ms  |       9130      | no errors |
|      [@adguard/agtree v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 11.52 (±5.35%) |      34      |   86.8069216176 ms  |       9130      | no errors |
| [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) |  0.03 (±1.53%) |       5      | 33231.4354162000 ms |       9125      | no errors |

## EasyList

|                                                            Tool                                                            |     ops/sec    | Runs sampled |  Average runtime  | Processed rules |   Status  |
| :------------------------------------------------------------------------------------------------------------------------: | :------------: | :----------: | :---------------: | :-------------: | :-------: |
|            [@adguard/agtree v2 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 25.31 (±2.23%) |      46      |  39.5107653696 ms |      62496      | no errors |
|            [@adguard/agtree v3 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 19.29 (±2.47%) |      36      |  51.8465758472 ms |      62496      | no errors |
|            [@adguard/agtree v1 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 11.43 (±1.88%) |      32      |  87.4946210625 ms |      62496      | no errors |
| [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) |  9.29 (±0.78%) |      28      | 107.6667962500 ms |      62496      | no errors |
|      [@adguard/agtree v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      |  7.27 (±2.79%) |      23      | 137.5026321739 ms |      62496      | no errors |
|      [@adguard/agtree v3 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      |  6.73 (±4.01%) |      21      | 148.6942619048 ms |      62496      | no errors |
|      [@adguard/agtree v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      |  2.45 (±2.77%) |      11      | 407.5710644545 ms |      62496      | no errors |
| [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) |  1.68 (±1.32%) |       9      | 594.4606714444 ms |      62496      | no errors |

<!--markdownlint-enable MD013-->
