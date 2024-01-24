# Benchmark results

## Environment

- Date: Wed, 24 Jan 2024 11:13:18 GMT
- Node.js version: v18.17.1
- OS: Linux 5.15

> [!NOTE]
> Results are sorted by performance (fastest first).

<!--markdownlint-disable MD013-->
## AdGuard Base List

|                                                            Tool                                                            |    ops/sec    | Runs sampled |   Average runtime  | Processed rules |   Status  |
| :------------------------------------------------------------------------------------------------------------------------: | :-----------: | :----------: | :----------------: | :-------------: | :-------: |
|            [@adguard/agtree v2 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 6.24 (±2.53%) |      20      |  160.3734059000 ms |      117222     | no errors |
| [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 3.79 (±1.12%) |      14      |  263.9632613571 ms |      118401     | no errors |
| [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 3.75 (±0.80%) |      14      |  266.3711777857 ms |      117222     | no errors |
|            [@adguard/agtree v1 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 2.70 (±5.52%) |      11      |  370.8950080909 ms |      117222     | no errors |
|      [@adguard/agtree v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 2.44 (±2.96%) |      11      |  409.4694429091 ms |      117222     | no errors |
|      [@adguard/agtree v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 0.74 (±3.86%) |       6      | 1355.0346535000 ms |      117222     | no errors |

## AdGuard Annoyances Filter

|                                                            Tool                                                            |    ops/sec    | Runs sampled |  Average runtime  | Processed rules |   Status  |
| :------------------------------------------------------------------------------------------------------------------------: | :-----------: | :----------: | :---------------: | :-------------: | :-------: |
|            [@adguard/agtree v2 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 9.18 (±1.79%) |      27      | 108.9446202963 ms |      45994      | no errors |
| [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 8.44 (±0.42%) |      25      | 118.4309159200 ms |      45993      | no errors |
| [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 7.59 (±0.39%) |      23      | 131.7411653913 ms |      45994      | no errors |
|      [@adguard/agtree v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 3.82 (±2.09%) |      14      | 261.6844940000 ms |      45994      | no errors |
|            [@adguard/agtree v1 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 3.55 (±5.31%) |      14      | 281.6522040714 ms |      45994      | no errors |
|      [@adguard/agtree v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 1.12 (±3.74%) |       7      | 895.9534032857 ms |      45994      | no errors |

## AdGuard Mobile Ads Filter

|                                                            Tool                                                            |     ops/sec    | Runs sampled |  Average runtime  | Processed rules |   Status  |
| :------------------------------------------------------------------------------------------------------------------------: | :------------: | :----------: | :---------------: | :-------------: | :-------: |
|            [@adguard/agtree v2 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 82.17 (±1.52%) |      72      |  12.1694416028 ms |       6743      | no errors |
| [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 65.53 (±0.58%) |      69      |  15.2602373841 ms |       6741      | no errors |
| [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 50.09 (±0.37%) |      66      |  19.9623880505 ms |       6743      | no errors |
|      [@adguard/agtree v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      | 31.84 (±1.47%) |      57      |  31.4101281316 ms |       6743      | no errors |
|            [@adguard/agtree v1 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 29.21 (±2.23%) |      53      |  34.2298045849 ms |       6743      | no errors |
|      [@adguard/agtree v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      |  8.76 (±2.98%) |      26      | 114.2135840769 ms |       6743      | no errors |

## uBlock Base List

|                                                            Tool                                                            |     ops/sec    | Runs sampled |  Average runtime  | Processed rules |   Status  |
| :------------------------------------------------------------------------------------------------------------------------: | :------------: | :----------: | :---------------: | :-------------: | :-------: |
| [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 23.82 (±0.73%) |      44      |  41.9859614545 ms |      11802      | no errors |
| [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 20.78 (±0.63%) |      39      |  48.1238031667 ms |      11766      | no errors |
|            [@adguard/agtree v2 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 19.81 (±1.50%) |      38      |  50.4802177895 ms |      11774      | no errors |
|            [@adguard/agtree v1 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 19.45 (±3.21%) |      37      |  51.4112362568 ms |      11774      | no errors |
|      [@adguard/agtree v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      |  8.75 (±1.38%) |      26      | 114.2688220769 ms |      11774      | no errors |
|      [@adguard/agtree v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      |  7.83 (±3.45%) |      24      | 127.6961297500 ms |      11774      | no errors |

## EasyList

|                                                            Tool                                                            |     ops/sec    | Runs sampled |  Average runtime  | Processed rules |   Status  |
| :------------------------------------------------------------------------------------------------------------------------: | :------------: | :----------: | :---------------: | :-------------: | :-------: |
|            [@adguard/agtree v2 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           | 15.71 (±2.57%) |      43      |  63.6684634419 ms |      67734      | no errors |
| [@adguard/tsurlfilter v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 10.63 (±0.60%) |      31      |  94.0941920645 ms |      67734      | no errors |
| [@adguard/tsurlfilter v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tsurlfilter) | 10.15 (±0.67%) |      30      |  98.5054574333 ms |      67734      | no errors |
|            [@adguard/agtree v1 - parser](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)           |  8.04 (±4.59%) |      25      | 124.3511341600 ms |      67734      | no errors |
|      [@adguard/agtree v2 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      |  5.69 (±3.17%) |      19      | 175.7375824737 ms |      67734      | no errors |
|      [@adguard/agtree v1 - parse and convert](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/agtree)      |  1.99 (±4.33%) |      10      | 503.3191579000 ms |      67734      | no errors |

<!--markdownlint-enable MD013-->
