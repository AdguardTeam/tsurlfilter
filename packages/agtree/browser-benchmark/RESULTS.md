# Benchmark results

Report generated on: Mon, 04 Mar 2024 14:50:25 GMT

## System specs

- CPU: Intel Gen Intel® Core™ i9-12900H (20 cores)
- Memory: 15826.36 MB
- OS: Ubuntu 22.04.3 LTS x64
- Node: v18.17.1

> [!NOTE]
> Results are sorted by performance (fastest first).

## EasyList

### Node.js v18.17.1

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 32.56 (±0.96%) | 58           | 30.7145213190 ms  | passed |
| Deserialize byte buffer to AST (new)  | 18.90 (±5.99%) | 36           | 52.9122275694 ms  | passed |
| Deserialize byte buffer to AST        | 16.07 (±8.94%) | 32           | 62.2343994375 ms  | passed |
| Parse string to AST                   | 7.97 (±7.58%)  | 24           | 125.4109908750 ms | passed |
| Clone AST to AST with structuredClone | 4.41 (±4.64%)  | 15           | 226.5491109333 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 1.70 MB  |
| Parsed filter list size       | 19.94 MB |
| Serialized size               | 2.78 MB  |
| Deserialized filter list size | 16.20 MB |

### chromium 121.0.6167.57

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 71.86 (±1.47%) | 52           | 13.9166666667 ms  | passed |
| Deserialize byte buffer to AST        | 24.85 (±3.30%) | 35           | 40.2476190476 ms  | passed |
| Parse string to AST                   | 23.15 (±3.69%) | 37           | 43.1936936937 ms  | passed |
| Deserialize byte buffer to AST (new)  | 13.10 (±5.41%) | 27           | 76.3333333333 ms  | passed |
| Clone AST to AST with structuredClone | 5.41 (±5.14%)  | 17           | 185.0000000000 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 1.70 MB  |
| Parsed filter list size       | 25.87 MB |
| Serialized size               | 2.78 MB  |
| Deserialized filter list size | 20.90 MB |

### firefox 121.0

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Deserialize byte buffer to AST (new)  | 15.97 (±4.20%) | 31           | 62.6129032258 ms  | passed |
| Parse string to AST                   | 12.90 (±4.46%) | 26           | 77.5384615385 ms  | passed |
| Serialize AST to byte buffer          | 12.25 (±0.83%) | 35           | 81.6000000000 ms  | passed |
| Deserialize byte buffer to AST        | 12.16 (±4.03%) | 25           | 82.2400000000 ms  | passed |
| Clone AST to AST with structuredClone | 3.95 (±7.00%)  | 14           | 253.2857142857 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 1.70 MB  |
| Parsed filter list size       | 25.87 MB |
| Serialized size               | 2.78 MB  |
| Deserialized filter list size | 20.90 MB |

### webkit 17.4

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 95.36 (±0.86%) | 57           | 10.4868421053 ms  | passed |
| Deserialize byte buffer to AST (new)  | 34.46 (±1.56%) | 47           | 29.0212765957 ms  | passed |
| Parse string to AST                   | 24.54 (±1.64%) | 45           | 40.7444444444 ms  | passed |
| Deserialize byte buffer to AST        | 18.80 (±1.77%) | 35           | 53.1857142857 ms  | passed |
| Clone AST to AST with structuredClone | 6.95 (±2.53%)  | 22           | 143.8181818182 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 1.70 MB  |
| Parsed filter list size       | 25.87 MB |
| Serialized size               | 2.78 MB  |
| Deserialized filter list size | 20.90 MB |


## AdGuard Base List

### Node.js v18.17.1

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 13.39 (±0.57%) | 37           | 74.6972222162 ms  | passed |
| Deserialize byte buffer to AST (new)  | 7.26 (±11.55%) | 23           | 137.8096165652 ms | passed |
| Deserialize byte buffer to AST        | 5.39 (±12.11%) | 18           | 185.5829031111 ms | passed |
| Parse string to AST                   | 3.20 (±6.58%)  | 12           | 312.1443570000 ms | passed |
| Clone AST to AST with structuredClone | 1.84 (±6.75%)  | 9            | 543.7353344444 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 6.09 MB  |
| Parsed filter list size       | 46.71 MB |
| Serialized size               | 7.32 MB  |
| Deserialized filter list size | 36.42 MB |

### chromium 121.0.6167.57

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 25.77 (±6.74%) | 38           | 38.7982456140 ms  | passed |
| Parse string to AST                   | 8.95 (±7.02%)  | 27           | 111.7037037037 ms | passed |
| Deserialize byte buffer to AST        | 8.48 (±7.95%)  | 25           | 117.9200000000 ms | passed |
| Deserialize byte buffer to AST (new)  | 4.95 (±14.13%) | 17           | 201.8823529412 ms | passed |
| Clone AST to AST with structuredClone | 1.85 (±11.84%) | 9            | 541.0000000000 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 6.09 MB  |
| Parsed filter list size       | 63.30 MB |
| Serialized size               | 7.32 MB  |
| Deserialized filter list size | 47.80 MB |

### firefox 121.0

#### Benchmark results

| Action                                | Ops/s         | Runs sampled | Average runtime   | Status |
| ------------------------------------- | ------------- | ------------ | ----------------- | ------ |
| Deserialize byte buffer to AST (new)  | 6.55 (±7.84%) | 21           | 152.6190476190 ms | passed |
| Deserialize byte buffer to AST        | 5.38 (±8.53%) | 18           | 185.8888888889 ms | passed |
| Parse string to AST                   | 4.87 (±7.87%) | 17           | 205.2941176471 ms | passed |
| Serialize AST to byte buffer          | 4.62 (±1.07%) | 16           | 216.5000000000 ms | passed |
| Clone AST to AST with structuredClone | 1.77 (±7.72%) | 9            | 565.2222222222 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 6.09 MB  |
| Parsed filter list size       | 63.30 MB |
| Serialized size               | 7.32 MB  |
| Deserialized filter list size | 47.80 MB |

### webkit 17.4

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 32.48 (±0.98%) | 45           | 30.7925925926 ms  | passed |
| Deserialize byte buffer to AST (new)  | 13.43 (±3.48%) | 27           | 74.4444444444 ms  | passed |
| Parse string to AST                   | 9.41 (±2.85%)  | 27           | 106.2222222222 ms | passed |
| Deserialize byte buffer to AST        | 6.20 (±2.41%)  | 21           | 161.2380952381 ms | passed |
| Clone AST to AST with structuredClone | 2.74 (±5.50%)  | 12           | 365.1666666667 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 6.09 MB  |
| Parsed filter list size       | 63.30 MB |
| Serialized size               | 7.32 MB  |
| Deserialized filter list size | 47.80 MB |


## uBlock Base List

### Node.js v18.17.1

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime  | Status |
| ------------------------------------- | -------------- | ------------ | ---------------- | ------ |
| Serialize AST to byte buffer          | 87.70 (±0.98%) | 76           | 11.4026176921 ms | passed |
| Deserialize byte buffer to AST (new)  | 87.18 (±4.47%) | 65           | 11.4699698395 ms | passed |
| Deserialize byte buffer to AST        | 55.98 (±6.42%) | 52           | 17.8646325462 ms | passed |
| Parse string to AST                   | 24.78 (±5.79%) | 45           | 40.3496080556 ms | passed |
| Clone AST to AST with structuredClone | 15.40 (±3.53%) | 42           | 64.9472702857 ms | passed |

#### Stats

| Stat                          | Value   |
| ----------------------------- | ------- |
| Raw filter list size          | 0.67 MB |
| Parsed filter list size       | 5.31 MB |
| Serialized size               | 0.75 MB |
| Deserialized filter list size | 4.17 MB |

### chromium 121.0.6167.57

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime  | Status |
| ------------------------------------- | -------------- | ------------ | ---------------- | ------ |
| Serialize AST to byte buffer          | 213 (±1.14%)   | 62           | 4.6878557875 ms  | passed |
| Deserialize byte buffer to AST        | 82.44 (±1.59%) | 51           | 12.1306022409 ms | passed |
| Parse string to AST                   | 73.30 (±1.56%) | 50           | 13.6433333333 ms | passed |
| Deserialize byte buffer to AST (new)  | 52.75 (±2.82%) | 48           | 18.9583333333 ms | passed |
| Clone AST to AST with structuredClone | 18.63 (±2.33%) | 35           | 53.6714285714 ms | passed |

#### Stats

| Stat                          | Value   |
| ----------------------------- | ------- |
| Raw filter list size          | 0.67 MB |
| Parsed filter list size       | 7.13 MB |
| Serialized size               | 0.75 MB |
| Deserialized filter list size | 5.45 MB |

### firefox 121.0

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime  | Status |
| ------------------------------------- | -------------- | ------------ | ---------------- | ------ |
| Deserialize byte buffer to AST (new)  | 48.22 (±2.21%) | 48           | 20.7395833333 ms | passed |
| Serialize AST to byte buffer          | 44.04 (±0.67%) | 48           | 22.7083333333 ms | passed |
| Deserialize byte buffer to AST        | 36.28 (±6.28%) | 40           | 27.5625000000 ms | passed |
| Parse string to AST                   | 32.54 (±4.14%) | 36           | 30.7314814815 ms | passed |
| Clone AST to AST with structuredClone | 15.05 (±1.38%) | 28           | 66.4285714286 ms | passed |

#### Stats

| Stat                          | Value   |
| ----------------------------- | ------- |
| Raw filter list size          | 0.67 MB |
| Parsed filter list size       | 7.13 MB |
| Serialized size               | 0.75 MB |
| Deserialized filter list size | 5.45 MB |

### webkit 17.4

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime  | Status |
| ------------------------------------- | -------------- | ------------ | ---------------- | ------ |
| Serialize AST to byte buffer          | 301 (±0.91%)   | 64           | 3.3199445199 ms  | passed |
| Deserialize byte buffer to AST (new)  | 100 (±0.98%)   | 56           | 9.9975198413 ms  | passed |
| Parse string to AST                   | 69.04 (±1.29%) | 54           | 14.4839506173 ms | passed |
| Deserialize byte buffer to AST        | 63.72 (±1.38%) | 49           | 15.6925170068 ms | passed |
| Clone AST to AST with structuredClone | 25.00 (±2.13%) | 39           | 40.0042735043 ms | passed |

#### Stats

| Stat                          | Value   |
| ----------------------------- | ------- |
| Raw filter list size          | 0.67 MB |
| Parsed filter list size       | 7.13 MB |
| Serialized size               | 0.75 MB |
| Deserialized filter list size | 5.45 MB |

