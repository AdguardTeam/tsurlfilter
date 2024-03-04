# Benchmark results

Report generated on: Mon, 04 Mar 2024 14:34:58 GMT

## System specs

- CPU: Intel Gen Intel® Core™ i9-12900H (20 cores)
- Memory: 15826.36 MB
- OS: Ubuntu 22.04.3 LTS x64
- Node: v18.17.1

> [!NOTE]
> Results are sorted by performance (fastest first).

## EasyList

### undefined undefined

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 31.52 (±1.93%) | 56           | 31.7283753125 ms  | passed |
| Deserialize byte buffer to AST (new)  | 18.13 (±6.87%) | 35           | 55.1437858143 ms  | passed |
| Deserialize byte buffer to AST        | 16.27 (±7.33%) | 31           | 61.4723305000 ms  | passed |
| Parse string to AST                   | 8.20 (±6.05%)  | 24           | 122.0115596250 ms | passed |
| Clone AST to AST with structuredClone | 4.23 (±5.21%)  | 15           | 236.3021070667 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 1.70 MB  |
| Parsed filter list size       | 19.94 MB |
| Serialized size               | 2.78 MB  |
| Deserialized filter list size | 16.20 MB |

### undefined undefined

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 70.82 (±1.69%) | 51           | 14.1209150327 ms  | passed |
| Deserialize byte buffer to AST        | 24.28 (±4.11%) | 35           | 41.1857142857 ms  | passed |
| Parse string to AST                   | 23.69 (±3.19%) | 40           | 42.2041666667 ms  | passed |
| Deserialize byte buffer to AST (new)  | 14.87 (±4.66%) | 28           | 67.2678571429 ms  | passed |
| Clone AST to AST with structuredClone | 5.17 (±5.45%)  | 16           | 193.3750000000 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 1.70 MB  |
| Parsed filter list size       | 25.87 MB |
| Serialized size               | 2.78 MB  |
| Deserialized filter list size | 20.90 MB |

### undefined undefined

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Deserialize byte buffer to AST (new)  | 14.51 (±3.96%) | 29           | 68.9310344828 ms  | passed |
| Parse string to AST                   | 13.04 (±3.75%) | 26           | 76.6730769231 ms  | passed |
| Serialize AST to byte buffer          | 12.22 (±1.00%) | 35           | 81.8000000000 ms  | passed |
| Deserialize byte buffer to AST        | 12.10 (±3.66%) | 24           | 82.6250000000 ms  | passed |
| Clone AST to AST with structuredClone | 4.02 (±6.22%)  | 14           | 248.5000000000 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 1.70 MB  |
| Parsed filter list size       | 25.87 MB |
| Serialized size               | 2.78 MB  |
| Deserialized filter list size | 20.90 MB |

### undefined undefined

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 95.16 (±0.95%) | 56           | 10.5089285714 ms  | passed |
| Deserialize byte buffer to AST (new)  | 34.11 (±1.41%) | 47           | 29.3191489362 ms  | passed |
| Parse string to AST                   | 24.21 (±1.65%) | 42           | 41.3055555556 ms  | passed |
| Deserialize byte buffer to AST        | 18.85 (±1.50%) | 35           | 53.0571428571 ms  | passed |
| Clone AST to AST with structuredClone | 7.04 (±2.17%)  | 22           | 141.9545454545 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 1.70 MB  |
| Parsed filter list size       | 25.87 MB |
| Serialized size               | 2.78 MB  |
| Deserialized filter list size | 20.90 MB |


## AdGuard Base List

### undefined undefined

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 13.03 (±1.47%) | 37           | 76.7594312162 ms  | passed |
| Deserialize byte buffer to AST (new)  | 7.34 (±8.40%)  | 23           | 136.2743059130 ms | passed |
| Deserialize byte buffer to AST        | 5.18 (±12.83%) | 18           | 192.8972075000 ms | passed |
| Parse string to AST                   | 3.18 (±4.88%)  | 13           | 314.4543621538 ms | passed |
| Clone AST to AST with structuredClone | 1.83 (±8.32%)  | 9            | 546.6889266667 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 6.09 MB  |
| Parsed filter list size       | 46.71 MB |
| Serialized size               | 7.32 MB  |
| Deserialized filter list size | 36.42 MB |

### undefined undefined

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 25.16 (±8.34%) | 37           | 39.7387387387 ms  | passed |
| Deserialize byte buffer to AST        | 8.53 (±6.00%)  | 25           | 117.2400000000 ms | passed |
| Parse string to AST                   | 8.41 (±7.99%)  | 26           | 118.8846153846 ms | passed |
| Deserialize byte buffer to AST (new)  | 5.50 (±9.73%)  | 18           | 181.7777777778 ms | passed |
| Clone AST to AST with structuredClone | 2.24 (±11.06%) | 9            | 446.7777777778 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 6.09 MB  |
| Parsed filter list size       | 63.30 MB |
| Serialized size               | 7.32 MB  |
| Deserialized filter list size | 47.79 MB |

### undefined undefined

#### Benchmark results

| Action                                | Ops/s         | Runs sampled | Average runtime   | Status |
| ------------------------------------- | ------------- | ------------ | ----------------- | ------ |
| Deserialize byte buffer to AST (new)  | 5.90 (±7.65%) | 19           | 169.4736842105 ms | passed |
| Deserialize byte buffer to AST        | 5.06 (±9.90%) | 17           | 197.8235294118 ms | passed |
| Parse string to AST                   | 4.76 (±7.86%) | 17           | 210.2352941176 ms | passed |
| Serialize AST to byte buffer          | 4.58 (±1.09%) | 16           | 218.1250000000 ms | passed |
| Clone AST to AST with structuredClone | 1.69 (±9.59%) | 9            | 591.6666666667 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 6.09 MB  |
| Parsed filter list size       | 63.30 MB |
| Serialized size               | 7.32 MB  |
| Deserialized filter list size | 47.79 MB |

### undefined undefined

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 33.28 (±1.25%) | 46           | 30.0507246377 ms  | passed |
| Deserialize byte buffer to AST (new)  | 13.27 (±3.11%) | 27           | 75.3333333333 ms  | passed |
| Parse string to AST                   | 9.14 (±3.29%)  | 27           | 109.3703703704 ms | passed |
| Deserialize byte buffer to AST        | 6.72 (±3.35%)  | 21           | 148.8571428571 ms | passed |
| Clone AST to AST with structuredClone | 2.83 (±1.44%)  | 12           | 353.8333333333 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 6.09 MB  |
| Parsed filter list size       | 63.30 MB |
| Serialized size               | 7.32 MB  |
| Deserialized filter list size | 47.79 MB |


## uBlock Base List

### undefined undefined

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime  | Status |
| ------------------------------------- | -------------- | ------------ | ---------------- | ------ |
| Deserialize byte buffer to AST (new)  | 86.70 (±3.42%) | 65           | 11.5346385410 ms | passed |
| Serialize AST to byte buffer          | 83.04 (±1.92%) | 73           | 12.0429725500 ms | passed |
| Deserialize byte buffer to AST        | 55.79 (±6.41%) | 51           | 17.9241559422 ms | passed |
| Parse string to AST                   | 25.42 (±3.90%) | 46           | 39.3324832283 ms | passed |
| Clone AST to AST with structuredClone | 15.23 (±3.79%) | 42           | 65.6646249762 ms | passed |

#### Stats

| Stat                          | Value   |
| ----------------------------- | ------- |
| Raw filter list size          | 0.67 MB |
| Parsed filter list size       | 5.31 MB |
| Serialized size               | 0.75 MB |
| Deserialized filter list size | 4.17 MB |

### undefined undefined

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime  | Status |
| ------------------------------------- | -------------- | ------------ | ---------------- | ------ |
| Serialize AST to byte buffer          | 215 (±0.97%)   | 62           | 4.6527514231 ms  | passed |
| Deserialize byte buffer to AST        | 82.91 (±1.57%) | 52           | 12.0618131868 ms | passed |
| Parse string to AST                   | 68.71 (±1.88%) | 53           | 14.5534591195 ms | passed |
| Deserialize byte buffer to AST (new)  | 52.93 (±2.49%) | 48           | 18.8916666667 ms | passed |
| Clone AST to AST with structuredClone | 19.56 (±0.94%) | 35           | 51.1285714286 ms | passed |

#### Stats

| Stat                          | Value   |
| ----------------------------- | ------- |
| Raw filter list size          | 0.67 MB |
| Parsed filter list size       | 7.13 MB |
| Serialized size               | 0.75 MB |
| Deserialized filter list size | 5.45 MB |

### undefined undefined

#### Benchmark results

| Action                                | Ops/s           | Runs sampled | Average runtime  | Status |
| ------------------------------------- | --------------- | ------------ | ---------------- | ------ |
| Serialize AST to byte buffer          | 61.98 (±0.98%)  | 55           | 16.1345454545 ms | passed |
| Deserialize byte buffer to AST (new)  | 51.91 (±3.10%)  | 46           | 19.2652173913 ms | passed |
| Deserialize byte buffer to AST        | 44.91 (±10.38%) | 35           | 22.2676190476 ms | passed |
| Parse string to AST                   | 32.06 (±4.35%)  | 35           | 31.1904761905 ms | passed |
| Clone AST to AST with structuredClone | 15.99 (±1.98%)  | 31           | 62.5483870968 ms | passed |

#### Stats

| Stat                          | Value   |
| ----------------------------- | ------- |
| Raw filter list size          | 0.67 MB |
| Parsed filter list size       | 7.13 MB |
| Serialized size               | 0.75 MB |
| Deserialized filter list size | 5.45 MB |

### undefined undefined

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime  | Status |
| ------------------------------------- | -------------- | ------------ | ---------------- | ------ |
| Serialize AST to byte buffer          | 287 (±1.90%)   | 61           | 3.4785484738 ms  | passed |
| Deserialize byte buffer to AST (new)  | 97.56 (±1.09%) | 58           | 10.2506157635 ms | passed |
| Parse string to AST                   | 68.81 (±1.69%) | 51           | 14.5325863679 ms | passed |
| Deserialize byte buffer to AST        | 62.16 (±1.52%) | 49           | 16.0880952381 ms | passed |
| Clone AST to AST with structuredClone | 25.53 (±1.62%) | 36           | 39.1712962963 ms | passed |

#### Stats

| Stat                          | Value   |
| ----------------------------- | ------- |
| Raw filter list size          | 0.67 MB |
| Parsed filter list size       | 7.13 MB |
| Serialized size               | 0.75 MB |
| Deserialized filter list size | 5.45 MB |

