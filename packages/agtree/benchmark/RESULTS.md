# Benchmark results

## Environment

- Date: Tue, 12 Dec 2023 14:03:15 GMT
- Node.js version: v18.17.1
- OS: Linux 5.15

> [!NOTE]
> Results are sorted by performance (fastest first).

<!--markdownlint-disable MD013-->
## AdGuard Base List

|                                                            Tool                                                            |    ops/sec    | Runs sampled |   Average runtime  | Processed rules |   Status  |
| :------------------------------------------------------------------------------------------------------------------------: | :-----------: | :----------: | :----------------: | :-------------: | :-------: |
|            [@adguard/agtree v2 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 4.40 (±4.52%) |      16      |  227.0532922500 ms |      114376     | no errors |
| [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 3.88 (±0.97%) |      14      |  258.0008580000 ms |      114376     | no errors |
| [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 3.76 (±1.11%) |      14      |  266.2552963571 ms |      115540     | no errors |
|            [@adguard/agtree v1 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 2.63 (±5.68%) |      11      |  380.0473333636 ms |      114376     | no errors |
|      [@adguard/agtree v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 1.61 (±4.52%) |       9      |  620.7521183333 ms |      114376     | no errors |
|      [@adguard/agtree v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 0.75 (±2.95%) |       6      | 1326.2270626667 ms |      114376     | no errors |

## AdGuard Annoyances Filter

|                                                            Tool                                                            |    ops/sec    | Runs sampled |  Average runtime  | Processed rules |   Status  |
| :------------------------------------------------------------------------------------------------------------------------: | :-----------: | :----------: | :---------------: | :-------------: | :-------: |
| [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 8.33 (±1.63%) |      25      | 119.9781295200 ms |      45467      | no errors |
| [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 7.79 (±0.56%) |      24      | 128.4177104167 ms |      45468      | no errors |
|            [@adguard/agtree v2 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 6.16 (±3.36%) |      20      | 162.3102395000 ms |      45468      | no errors |
|            [@adguard/agtree v1 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 3.54 (±3.78%) |      14      | 282.3064771429 ms |      45468      | no errors |
|      [@adguard/agtree v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 2.36 (±3.62%) |      10      | 423.5180626000 ms |      45468      | no errors |
|      [@adguard/agtree v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 1.09 (±6.22%) |       7      | 918.6340444286 ms |      45468      | no errors |

## AdGuard Mobile Ads Filter

|                                                            Tool                                                            |     ops/sec    | Runs sampled |  Average runtime  | Processed rules |   Status  |
| :------------------------------------------------------------------------------------------------------------------------: | :------------: | :----------: | :---------------: | :-------------: | :-------: |
| [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 66.71 (±0.45%) |      70      |  14.9903966286 ms |       6624      | no errors |
|            [@adguard/agtree v2 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 56.12 (±2.26%) |      60      |  17.8181076056 ms |       6625      | no errors |
| [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 53.57 (±0.32%) |      70      |  18.6687396714 ms |       6625      | no errors |
|            [@adguard/agtree v1 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 28.45 (±3.21%) |      52      |  35.1454598173 ms |       6625      | no errors |
|      [@adguard/agtree v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 21.16 (±1.77%) |      40      |  47.2585943625 ms |       6625      | no errors |
|      [@adguard/agtree v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      |  8.72 (±2.00%) |      26      | 114.7106876923 ms |       6625      | no errors |

## uBlock Base List

|                                                            Tool                                                            |     ops/sec    | Runs sampled |  Average runtime  | Processed rules |   Status  |
| :------------------------------------------------------------------------------------------------------------------------: | :------------: | :----------: | :---------------: | :-------------: | :-------: |
|            [@adguard/agtree v2 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 33.14 (±2.22%) |      59      |  30.1771164068 ms |      12229      | no errors |
| [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 22.72 (±0.56%) |      42      |  44.0071092857 ms |      12258      | no errors |
| [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 19.78 (±0.86%) |      37      |  50.5677765541 ms |      12219      | no errors |
|            [@adguard/agtree v1 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 18.88 (±2.80%) |      36      |  52.9778113333 ms |      12229      | no errors |
|      [@adguard/agtree v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 12.65 (±2.40%) |      36      |  79.0679927222 ms |      12229      | no errors |
|      [@adguard/agtree v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      |  7.58 (±3.36%) |      24      | 131.9675452917 ms |      12229      | no errors |

## EasyList

|                                                            Tool                                                            |     ops/sec    | Runs sampled |  Average runtime  | Processed rules |   Status  |
| :------------------------------------------------------------------------------------------------------------------------: | :------------: | :----------: | :---------------: | :-------------: | :-------: |
|            [@adguard/agtree v2 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 12.30 (±2.57%) |      35      |  81.3054506286 ms |      65211      | no errors |
| [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 10.94 (±0.52%) |      32      |  91.4072321562 ms |      65211      | no errors |
| [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 10.63 (±0.48%) |      31      |  94.0361756129 ms |      65211      | no errors |
|            [@adguard/agtree v1 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           |  8.24 (±5.10%) |      25      | 121.4255464000 ms |      65211      | no errors |
|      [@adguard/agtree v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      |  4.40 (±4.75%) |      16      | 227.0952640625 ms |      65211      | no errors |
|      [@adguard/agtree v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      |  2.16 (±4.26%) |      10      | 463.8661264000 ms |      65211      | no errors |

<!--markdownlint-enable MD013-->
