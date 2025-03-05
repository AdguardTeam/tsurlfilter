# Benchmark results

Date: Thu, 30 Jan 2025 10:26:44 GMT

## System Specs

| Spec   | Value                           |
| :----- | :------------------------------ |
| CPU    | Intel Core™ i7-9750H (12 cores) |
| Memory | 16384.00 MB                     |
| OS     | macOS 14.6.1 x64                |
| Node   | v18.18.2                        |

> [!NOTE]
> Results are sorted by performance (fastest first).

<!--markdownlint-disable MD013-->
## Bootstrap

|                                                Tokenizer                                                |     ops/sec     | Runs sampled |  Average runtime | Tokens |   Status  |
| :-----------------------------------------------------------------------------------------------------: | :-------------: | :----------: | :--------------: | :----: | :-------: |
|                              [css-tree](https://github.com/csstree/csstree)                             |   270 (±5.47%)  |      76      |  3.7081475457 ms |  72249 | no errors |
| [@adguard/css-tokenizer](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer) |   208 (±5.72%)  |      76      |  4.7988309574 ms |  72249 | no errors |
|                              [csslex](https://github.com/keithamus/csslex)                              |   101 (±3.15%)  |      65      |  9.8651358649 ms |  72249 | no errors |
|                       [@csstools/tokenizer](https://github.com/csstools/tokenizer)                      |  87.46 (±0.97%) |      73      | 11.4333315260 ms |  72611 | no errors |
|                           [parse-css](https://github.com/tabatkins/parse-css)                           | 44.35 (±13.63%) |      62      | 22.5494988495 ms |  72228 | no errors |
| [@csstools/css-tokenizer](https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer) | 21.63 (±19.50%) |      39      | 46.2287616496 ms |  72250 | no errors |

## Bulma

|                                                Tokenizer                                                |     ops/sec    | Runs sampled |  Average runtime | Tokens |   Status  |
| :-----------------------------------------------------------------------------------------------------: | :------------: | :----------: | :--------------: | :----: | :-------: |
| [@adguard/css-tokenizer](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer) |  348 (±1.13%)  |      88      |  2.8709996068 ms |  75215 | no errors |
|                              [css-tree](https://github.com/csstree/csstree)                             |  345 (±0.71%)  |      90      |  2.8946954351 ms |  75215 | no errors |
|                       [@csstools/tokenizer](https://github.com/csstools/tokenizer)                      |  155 (±0.32%)  |      87      |  6.4465536753 ms |  75712 | no errors |
|                              [csslex](https://github.com/keithamus/csslex)                              |  102 (±2.99%)  |      66      |  9.7687063413 ms |  75215 | no errors |
|                           [parse-css](https://github.com/tabatkins/parse-css)                           | 64.38 (±1.65%) |      67      | 15.5322786194 ms |  75205 | no errors |
| [@csstools/css-tokenizer](https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer) | 48.51 (±3.19%) |      63      | 20.6145774074 ms |  75216 | no errors |

## Foundation

|                                                Tokenizer                                                |     ops/sec    | Runs sampled |  Average runtime | Tokens |   Status  |
| :-----------------------------------------------------------------------------------------------------: | :------------: | :----------: | :--------------: | :----: | :-------: |
|                              [css-tree](https://github.com/csstree/csstree)                             |  553 (±0.56%)  |      93      |  1.8080485951 ms |  50873 | no errors |
| [@adguard/css-tokenizer](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer) |  481 (±1.13%)  |      89      |  2.0798233761 ms |  50874 | no errors |
|                       [@csstools/tokenizer](https://github.com/csstools/tokenizer)                      |  218 (±5.32%)  |      85      |  4.5973362510 ms |  51528 | no errors |
|                              [csslex](https://github.com/keithamus/csslex)                              |  125 (±2.87%)  |      68      |  7.9837495076 ms |  50873 | no errors |
|                           [parse-css](https://github.com/tabatkins/parse-css)                           | 74.94 (±3.74%) |      65      | 13.3445165269 ms |  50870 | no errors |
| [@csstools/css-tokenizer](https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer) | 43.00 (±9.68%) |      45      | 23.2561000370 ms |  50874 | no errors |

## Fomantic UI

|                                                Tokenizer                                                |     ops/sec    | Runs sampled |  Average runtime  | Tokens |   Status  |
| :-----------------------------------------------------------------------------------------------------: | :------------: | :----------: | :---------------: | :----: | :-------: |
|                              [css-tree](https://github.com/csstree/csstree)                             | 46.56 (±0.65%) |      61      |  21.4797374918 ms | 534502 | no errors |
| [@adguard/css-tokenizer](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer) | 45.19 (±4.75%) |      60      |  22.1265246611 ms | 534502 | no errors |
|                       [@csstools/tokenizer](https://github.com/csstools/tokenizer)                      | 19.72 (±0.48%) |      39      |  50.7131039487 ms | 535714 | no errors |
|                              [csslex](https://github.com/keithamus/csslex)                              | 11.68 (±5.31%) |      33      |  85.6491360606 ms | 534504 | no errors |
|                           [parse-css](https://github.com/tabatkins/parse-css)                           |  4.62 (±5.57%) |      16      | 216.3331198750 ms | 534088 | no errors |
| [@csstools/css-tokenizer](https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer) | 2.90 (±17.93%) |      12      | 345.3981200833 ms | 534505 | no errors |

## Font Awesome

|                                                Tokenizer                                                |     ops/sec    | Runs sampled |  Average runtime | Tokens |   Status  |
| :-----------------------------------------------------------------------------------------------------: | :------------: | :----------: | :--------------: | :----: | :-------: |
|                              [css-tree](https://github.com/csstree/csstree)                             |  771 (±0.96%)  |      92      |  1.2966780329 ms |  43905 | no errors |
| [@adguard/css-tokenizer](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer) |  598 (±0.55%)  |      91      |  1.6734684521 ms |  43905 | no errors |
|                       [@csstools/tokenizer](https://github.com/csstools/tokenizer)                      |  276 (±0.56%)  |      86      |  3.6260228059 ms |  43965 | no errors |
|                              [csslex](https://github.com/keithamus/csslex)                              |  136 (±8.39%)  |      64      |  7.3295262969 ms |  43905 | no errors |
| [@csstools/css-tokenizer](https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer) | 73.59 (±2.33%) |      63      | 13.5892927429 ms |  43906 | no errors |
|                           [parse-css](https://github.com/tabatkins/parse-css)                           | 66.85 (±2.03%) |      69      | 14.9596465543 ms |  43923 | no errors |

## jQuery UI

|                                                Tokenizer                                                |    ops/sec    | Runs sampled | Average runtime | Tokens |   Status  |
| :-----------------------------------------------------------------------------------------------------: | :-----------: | :----------: | :-------------: | :----: | :-------: |
|                              [css-tree](https://github.com/csstree/csstree)                             | 3042 (±1.86%) |      96      | 0.3287597224 ms |  8818  | no errors |
| [@adguard/css-tokenizer](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer) | 2257 (±1.75%) |      91      | 0.4429903142 ms |  8818  | no errors |
|                       [@csstools/tokenizer](https://github.com/csstools/tokenizer)                      | 1065 (±1.17%) |      89      | 0.9387706021 ms |  8852  | no errors |
|                              [csslex](https://github.com/keithamus/csslex)                              |  795 (±3.12%) |      74      | 1.2572937049 ms |  8818  | no errors |
|                           [parse-css](https://github.com/tabatkins/parse-css)                           |  350 (±2.59%) |      88      | 2.8578770076 ms |  8785  | no errors |
| [@csstools/css-tokenizer](https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer) |  336 (±0.81%) |      89      | 2.9728763876 ms |  8819  | no errors |

## AdGuard Base List

|                                                Tokenizer                                                |     ops/sec    | Runs sampled |  Average runtime  | Tokens |   Status  |
| :-----------------------------------------------------------------------------------------------------: | :------------: | :----------: | :---------------: | :----: | :-------: |
| [@adguard/css-tokenizer](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer) | 56.55 (±4.79%) |      60      |  17.6834078472 ms | 341236 | no errors |
|                              [css-tree](https://github.com/csstree/csstree)                             | 55.89 (±6.54%) |      60      |  17.8914359583 ms | 341236 | no errors |
|                       [@csstools/tokenizer](https://github.com/csstools/tokenizer)                      | 25.75 (±4.16%) |      46      |  38.8421099891 ms | 298553 | no errors |
|                              [csslex](https://github.com/keithamus/csslex)                              | 17.77 (±2.18%) |      34      |  56.2637567353 ms | 341246 | no errors |
| [@csstools/css-tokenizer](https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer) |  4.99 (±3.76%) |      17      | 200.4833514118 ms | 341247 | no errors |
|                           [parse-css](https://github.com/tabatkins/parse-css)                           |  0.00 (±0.00%) |       0      |  0.0000000000 ms  |   N/A  |   failed  |

## AdGuard Annoyances Filter

|                                                Tokenizer                                                |     ops/sec    | Runs sampled |  Average runtime  | Tokens |   Status  |
| :-----------------------------------------------------------------------------------------------------: | :------------: | :----------: | :---------------: | :----: | :-------: |
|                              [css-tree](https://github.com/csstree/csstree)                             | 58.68 (±0.44%) |      65      |  17.0403076500 ms | 339810 | no errors |
| [@adguard/css-tokenizer](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer) | 57.16 (±0.99%) |      67      |  17.4940191169 ms | 339808 | no errors |
|                       [@csstools/tokenizer](https://github.com/csstools/tokenizer)                      | 27.65 (±0.65%) |      49      |  36.1695965102 ms | 226027 | no errors |
|                              [csslex](https://github.com/keithamus/csslex)                              | 18.16 (±2.82%) |      34      |  55.0709890294 ms | 339825 | no errors |
| [@csstools/css-tokenizer](https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer) |  5.41 (±2.03%) |      17      | 184.9118453529 ms | 339826 | no errors |
|                           [parse-css](https://github.com/tabatkins/parse-css)                           |  0.00 (±0.00%) |       0      |  0.0000000000 ms  |   N/A  |   failed  |

## AdGuard Mobile Ads Filter

|                                                Tokenizer                                                |     ops/sec    | Runs sampled |  Average runtime | Tokens |   Status  |
| :-----------------------------------------------------------------------------------------------------: | :------------: | :----------: | :--------------: | :----: | :-------: |
|                              [css-tree](https://github.com/csstree/csstree)                             |  386 (±0.44%)  |      92      |  2.5911729538 ms |  52238 | no errors |
| [@adguard/css-tokenizer](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer) |  367 (±0.81%)  |      87      |  2.7271142588 ms |  52238 | no errors |
|                       [@csstools/tokenizer](https://github.com/csstools/tokenizer)                      |  170 (±0.87%)  |      86      |  5.8786797416 ms |  52249 | no errors |
|                              [csslex](https://github.com/keithamus/csslex)                              |  128 (±2.63%)  |      73      |  7.8264106035 ms |  52240 | no errors |
|                           [parse-css](https://github.com/tabatkins/parse-css)                           | 61.41 (±3.61%) |      64      | 16.2843308320 ms |  50556 | no errors |
| [@csstools/css-tokenizer](https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer) | 43.77 (±2.84%) |      58      | 22.8443752931 ms |  52241 | no errors |

## uBlock Base List

|                                                Tokenizer                                                |    ops/sec    | Runs sampled | Average runtime | Tokens |   Status  |
| :-----------------------------------------------------------------------------------------------------: | :-----------: | :----------: | :-------------: | :----: | :-------: |
|                              [css-tree](https://github.com/csstree/csstree)                             | 1034 (±0.54%) |      92      | 0.9667334829 ms |  19429 | no errors |
| [@adguard/css-tokenizer](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/css-tokenizer) |  959 (±0.53%) |      91      | 1.0432209931 ms |  19429 | no errors |
|                       [@csstools/tokenizer](https://github.com/csstools/tokenizer)                      |  459 (±0.71%) |      88      | 2.1765661026 ms |  19425 | no errors |
|                              [csslex](https://github.com/keithamus/csslex)                              |  331 (±2.18%) |      76      | 3.0216797444 ms |  19429 | no errors |
|                           [parse-css](https://github.com/tabatkins/parse-css)                           |  180 (±0.65%) |      83      | 5.5637690364 ms |  18856 | no errors |
| [@csstools/css-tokenizer](https://github.com/csstools/postcss-plugins/tree/main/packages/css-tokenizer) |  152 (±3.95%) |      77      | 6.5718441934 ms |  19430 | no errors |

<!--markdownlint-enable MD013-->
