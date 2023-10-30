# Benchmark results

## Environment

- Date: Mon, 23 Oct 2023 11:09:33 GMT
- Node.js version: v18.17.1
- OS: Linux 5.15

> [!NOTE]
> Results are sorted by performance (fastest first).

<!--markdownlint-disable MD013-->
## Bootstrap

|                                                Tokenizer                                                |     ops/sec    | Runs sampled |  Average runtime | Tokens |   Status  |
| :-----------------------------------------------------------------------------------------------------: | :------------: | :----------: | :--------------: | :----: | :-------: |
| [@adguard/css-tokenizer](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer) |  678 (±0.58%)  |      95      |  1.4751103601 ms |  72249 | no errors |
|                              [css-tree](https://github.com/csstree/csstree)                             |  655 (±0.30%)  |      96      |  1.5263193413 ms |  72249 | no errors |
|                       [@csstools/tokenizer](https://github.com/csstools/tokenizer)                      |  293 (±0.25%)  |      90      |  3.4124665216 ms |  72611 | no errors |
|                              [csslex](https://github.com/keithamus/csslex)                              |  215 (±2.71%)  |      77      |  4.6587483439 ms |  72249 | no errors |
|                           [parse-css](https://github.com/tabatkins/parse-css)                           | 97.19 (±1.36%) |      72      | 10.2889108491 ms |  72228 | no errors |
| [@csstools/css-tokenizer](https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer) | 68.88 (±2.61%) |      60      | 14.5175841833 ms |  72250 | no errors |

## Bulma

|                                                Tokenizer                                                |     ops/sec    | Runs sampled |  Average runtime | Tokens |   Status  |
| :-----------------------------------------------------------------------------------------------------: | :------------: | :----------: | :--------------: | :----: | :-------: |
| [@adguard/css-tokenizer](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer) |  775 (±0.35%)  |      97      |  1.2906238496 ms |  75215 | no errors |
|                              [css-tree](https://github.com/csstree/csstree)                             |  730 (±0.26%)  |      96      |  1.3704211252 ms |  75215 | no errors |
|                       [@csstools/tokenizer](https://github.com/csstools/tokenizer)                      |  307 (±0.31%)  |      93      |  3.2579037218 ms |  75712 | no errors |
|                              [csslex](https://github.com/keithamus/csslex)                              |  216 (±2.74%)  |      80      |  4.6244439891 ms |  75215 | no errors |
|                           [parse-css](https://github.com/tabatkins/parse-css)                           |  130 (±1.51%)  |      84      |  7.7125864167 ms |  75205 | no errors |
| [@csstools/css-tokenizer](https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer) | 77.86 (±2.82%) |      68      | 12.8432758294 ms |  75216 | no errors |

## Foundation

|                                                Tokenizer                                                |    ops/sec    | Runs sampled | Average runtime | Tokens |   Status  |
| :-----------------------------------------------------------------------------------------------------: | :-----------: | :----------: | :-------------: | :----: | :-------: |
| [@adguard/css-tokenizer](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer) | 1149 (±0.31%) |      96      | 0.8704606604 ms |  50874 | no errors |
|                              [css-tree](https://github.com/csstree/csstree)                             | 1060 (±0.35%) |      96      | 0.9437109600 ms |  50873 | no errors |
|                       [@csstools/tokenizer](https://github.com/csstools/tokenizer)                      |  456 (±0.27%) |      94      | 2.1942941175 ms |  51528 | no errors |
|                              [csslex](https://github.com/keithamus/csslex)                              |  268 (±2.48%) |      77      | 3.7351010328 ms |  50873 | no errors |
|                           [parse-css](https://github.com/tabatkins/parse-css)                           |  174 (±1.55%) |      83      | 5.7578719589 ms |  50870 | no errors |
| [@csstools/css-tokenizer](https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer) |  110 (±2.77%) |      72      | 9.1276466128 ms |  50874 | no errors |

## Fomantic UI

|                                                Tokenizer                                                |     ops/sec    | Runs sampled |  Average runtime | Tokens |   Status  |
| :-----------------------------------------------------------------------------------------------------: | :------------: | :----------: | :--------------: | :----: | :-------: |
| [@adguard/css-tokenizer](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer) |  110 (±0.37%)  |      82      |  9.0670222276 ms | 534504 | no errors |
|                              [css-tree](https://github.com/csstree/csstree)                             | 97.79 (±0.32%) |      74      | 10.2262439374 ms | 534502 | no errors |
|                       [@csstools/tokenizer](https://github.com/csstools/tokenizer)                      | 42.50 (±0.30%) |      57      | 23.5312804386 ms | 535714 | no errors |
|                              [csslex](https://github.com/keithamus/csslex)                              | 25.65 (±3.12%) |      47      | 38.9919680851 ms | 534504 | no errors |
| [@csstools/css-tokenizer](https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer) | 10.64 (±0.83%) |      29      | 94.0178075517 ms | 534505 | no errors |
|                           [parse-css](https://github.com/tabatkins/parse-css)                           | 10.10 (±1.65%) |      30      | 99.0240675667 ms | 534088 | no errors |

## Font Awesome

|                                                Tokenizer                                                |    ops/sec    | Runs sampled | Average runtime | Tokens |   Status  |
| :-----------------------------------------------------------------------------------------------------: | :-----------: | :----------: | :-------------: | :----: | :-------: |
|                              [css-tree](https://github.com/csstree/csstree)                             | 1563 (±0.30%) |      96      | 0.6398423604 ms |  43905 | no errors |
| [@adguard/css-tokenizer](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer) | 1557 (±0.37%) |      98      | 0.6423208017 ms |  43905 | no errors |
|                       [@csstools/tokenizer](https://github.com/csstools/tokenizer)                      |  584 (±0.30%) |      94      | 1.7117446765 ms |  43965 | no errors |
|                              [csslex](https://github.com/keithamus/csslex)                              |  326 (±2.50%) |      76      | 3.0648706150 ms |  43905 | no errors |
|                           [parse-css](https://github.com/tabatkins/parse-css)                           |  135 (±1.24%) |      78      | 7.4238688826 ms |  43923 | no errors |
| [@csstools/css-tokenizer](https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer) |  129 (±2.61%) |      75      | 7.7635107989 ms |  43906 | no errors |

## jQuery UI

|                                                Tokenizer                                                |    ops/sec    | Runs sampled | Average runtime | Tokens |   Status  |
| :-----------------------------------------------------------------------------------------------------: | :-----------: | :----------: | :-------------: | :----: | :-------: |
| [@adguard/css-tokenizer](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer) | 5903 (±0.23%) |      98      | 0.1694111919 ms |  8818  | no errors |
|                              [css-tree](https://github.com/csstree/csstree)                             | 5802 (±0.28%) |      97      | 0.1723567168 ms |  8818  | no errors |
|                       [@csstools/tokenizer](https://github.com/csstools/tokenizer)                      | 2328 (±0.29%) |      98      | 0.4296036582 ms |  8852  | no errors |
|                              [csslex](https://github.com/keithamus/csslex)                              | 1684 (±2.24%) |      80      | 0.5938042832 ms |  8818  | no errors |
|                           [parse-css](https://github.com/tabatkins/parse-css)                           |  760 (±0.26%) |      98      | 1.3164588940 ms |  8785  | no errors |
| [@csstools/css-tokenizer](https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer) |  555 (±2.70%) |      85      | 1.8005803315 ms |  8819  | no errors |

## AdGuard Base List

|                                                Tokenizer                                                |     ops/sec    | Runs sampled |  Average runtime | Tokens |   Status  |
| :-----------------------------------------------------------------------------------------------------: | :------------: | :----------: | :--------------: | :----: | :-------: |
| [@adguard/css-tokenizer](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer) |  144 (±0.28%)  |      83      |  6.9488601250 ms | 297915 | no errors |
|                              [css-tree](https://github.com/csstree/csstree)                             |  132 (±0.25%)  |      85      |  7.5810497748 ms | 297913 | no errors |
|                       [@csstools/tokenizer](https://github.com/csstools/tokenizer)                      | 62.23 (±0.29%) |      66      | 16.0704132121 ms | 269324 | no errors |
|                              [csslex](https://github.com/keithamus/csslex)                              | 41.68 (±2.66%) |      56      | 23.9937326250 ms | 297924 | no errors |
| [@csstools/css-tokenizer](https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer) | 15.20 (±2.53%) |      42      | 65.7808102857 ms | 297925 | no errors |
|                           [parse-css](https://github.com/tabatkins/parse-css)                           |  0.00 (±0.00%) |       0      |  0.0000000000 ms |   N/A  |   failed  |

## AdGuard Annoyances Filter

|                                                Tokenizer                                                |     ops/sec    | Runs sampled |  Average runtime | Tokens |   Status  |
| :-----------------------------------------------------------------------------------------------------: | :------------: | :----------: | :--------------: | :----: | :-------: |
| [@adguard/css-tokenizer](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer) |  148 (±0.30%)  |      85      |  6.7771021324 ms | 279851 | no errors |
|                              [css-tree](https://github.com/csstree/csstree)                             |  139 (±0.23%)  |      81      |  7.1762287855 ms | 279851 | no errors |
|                       [@csstools/tokenizer](https://github.com/csstools/tokenizer)                      | 72.21 (±0.79%) |      75      | 13.8484045400 ms | 181137 | no errors |
|                              [csslex](https://github.com/keithamus/csslex)                              | 45.86 (±2.73%) |      61      | 21.8038467158 ms | 279862 | no errors |
| [@csstools/css-tokenizer](https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer) | 15.57 (±2.96%) |      43      | 64.2089721860 ms | 279863 | no errors |
|                           [parse-css](https://github.com/tabatkins/parse-css)                           |  0.00 (±0.00%) |       0      |  0.0000000000 ms |   N/A  |   failed  |

## AdGuard Mobile Ads Filter

|                                                Tokenizer                                                |    ops/sec    | Runs sampled | Average runtime | Tokens |   Status  |
| :-----------------------------------------------------------------------------------------------------: | :-----------: | :----------: | :-------------: | :----: | :-------: |
| [@adguard/css-tokenizer](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer) | 1058 (±0.34%) |      96      | 0.9449868712 ms |  40443 | no errors |
|                              [css-tree](https://github.com/csstree/csstree)                             |  972 (±0.26%) |      97      | 1.0288468562 ms |  40443 | no errors |
|                       [@csstools/tokenizer](https://github.com/csstools/tokenizer)                      |  449 (±0.28%) |      92      | 2.2253225365 ms |  40453 | no errors |
|                              [csslex](https://github.com/keithamus/csslex)                              |  312 (±1.90%) |      79      | 3.2055811946 ms |  40445 | no errors |
|                           [parse-css](https://github.com/tabatkins/parse-css)                           |  177 (±0.75%) |      84      | 5.6368659095 ms |  39106 | no errors |
| [@csstools/css-tokenizer](https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer) |  112 (±1.99%) |      73      | 8.9473396670 ms |  40446 | no errors |

## uBlock Base List

|                                                Tokenizer                                                |    ops/sec    | Runs sampled | Average runtime | Tokens |   Status  |
| :-----------------------------------------------------------------------------------------------------: | :-----------: | :----------: | :-------------: | :----: | :-------: |
| [@adguard/css-tokenizer](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer) | 1723 (±0.20%) |      98      | 0.5802379960 ms |  24322 | no errors |
|                              [css-tree](https://github.com/csstree/csstree)                             | 1555 (±0.22%) |      98      | 0.6429304859 ms |  24322 | no errors |
|                       [@csstools/tokenizer](https://github.com/csstools/tokenizer)                      |  745 (±0.23%) |      95      | 1.3427479437 ms |  24321 | no errors |
|                              [csslex](https://github.com/keithamus/csslex)                              |  528 (±2.24%) |      83      | 1.8936886689 ms |  24322 | no errors |
|                           [parse-css](https://github.com/tabatkins/parse-css)                           |  286 (±0.74%) |      92      | 3.4927348275 ms |  23571 | no errors |
| [@csstools/css-tokenizer](https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer) |  184 (±1.99%) |      79      | 5.4244890018 ms |  24323 | no errors |

<!--markdownlint-enable MD013-->
