# Benchmark results

Report generated on: Wed, 20 Mar 2024 09:14:51 GMT

## System specs

- CPU: Intel Gen Intel® Core™ i9-12900K (24 cores)
- Memory: 31967.62 MB
- OS: Ubuntu 22.04.2 LTS x64
- Node: v18.17.1

> [!NOTE]
> Results are sorted by performance (fastest first).

## EasyList

### Node.js v18.17.1

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Deserialize byte buffer to AST        | 28.10 (±6.54%) | 51           | 35.5890314608 ms  | passed |
| Serialize AST to byte buffer          | 25.98 (±0.75%) | 47           | 38.4959756064 ms  | passed |
| Parse string to AST                   | 9.87 (±6.70%)  | 29           | 101.3500003793 ms | passed |
| Clone AST to AST with structuredClone | 5.23 (±2.89%)  | 18           | 191.3101873333 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size (utf-8)  | 1.71 MB  |
| Parsed filter list size       | 20.04 MB |
| Serialized size               | 2.79 MB  |
| Deserialized filter list size | 19.08 MB |

### chromium 121.0.6167.57

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 58.95 (±1.72%) | 53           | 16.9622641509 ms  | passed |
| Parse string to AST                   | 27.86 (±2.52%) | 39           | 35.8888888889 ms  | passed |
| Deserialize byte buffer to AST        | 26.42 (±2.00%) | 37           | 37.8468468468 ms  | passed |
| Clone AST to AST with structuredClone | 6.00 (±0.91%)  | 18           | 166.7777777778 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size (utf-8)  | 1.71 MB  |
| Parsed filter list size       | 25.98 MB |
| Serialized size               | 2.79 MB  |
| Deserialized filter list size | 22.86 MB |

### firefox 121.0

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Deserialize byte buffer to AST        | 17.79 (±2.69%) | 33           | 56.2121212121 ms  | passed |
| Serialize AST to byte buffer          | 14.92 (±1.70%) | 29           | 67.0344827586 ms  | passed |
| Parse string to AST                   | 13.60 (±3.52%) | 27           | 73.5185185185 ms  | passed |
| Clone AST to AST with structuredClone | 4.27 (±5.16%)  | 15           | 234.3333333333 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size (utf-8)  | 1.71 MB  |
| Parsed filter list size       | 25.98 MB |
| Serialized size               | 2.79 MB  |
| Deserialized filter list size | 22.86 MB |

### webkit 17.4

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Deserialize byte buffer to AST        | 37.82 (±1.01%) | 45           | 26.4425925926 ms  | passed |
| Serialize AST to byte buffer          | 32.82 (±0.50%) | 45           | 30.4666666667 ms  | passed |
| Parse string to AST                   | 24.85 (±0.87%) | 35           | 40.2380952381 ms  | passed |
| Clone AST to AST with structuredClone | 7.66 (±1.89%)  | 24           | 130.5000000000 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size (utf-8)  | 1.71 MB  |
| Parsed filter list size       | 25.98 MB |
| Serialized size               | 2.79 MB  |
| Deserialized filter list size | 22.86 MB |


## AdGuard Base List

### Node.js v18.17.1

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 10.29 (±5.42%) | 30           | 97.1684905667 ms  | passed |
| Deserialize byte buffer to AST        | 9.94 (±6.91%)  | 29           | 100.6183961034 ms | passed |
| Parse string to AST                   | 3.91 (±8.54%)  | 14           | 255.9293730000 ms | passed |
| Clone AST to AST with structuredClone | 2.15 (±9.13%)  | 10           | 466.1591778000 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size (utf-8)  | 6.13 MB  |
| Parsed filter list size       | 46.99 MB |
| Serialized size               | 7.38 MB  |
| Deserialized filter list size | 41.80 MB |

### chromium 121.0.6167.57

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 19.72 (±4.93%) | 38           | 50.6973684211 ms  | passed |
| Parse string to AST                   | 10.39 (±4.28%) | 30           | 96.2333333333 ms  | passed |
| Deserialize byte buffer to AST        | 9.88 (±3.07%)  | 29           | 101.2413793103 ms | passed |
| Clone AST to AST with structuredClone | 2.63 (±0.73%)  | 10           | 380.6000000000 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size (utf-8)  | 6.13 MB  |
| Parsed filter list size       | 63.69 MB |
| Serialized size               | 7.38 MB  |
| Deserialized filter list size | 52.01 MB |

### firefox 121.0

#### Benchmark results

| Action                                | Ops/s         | Runs sampled | Average runtime   | Status |
| ------------------------------------- | ------------- | ------------ | ----------------- | ------ |
| Deserialize byte buffer to AST        | 7.13 (±5.66%) | 22           | 140.2272727273 ms | passed |
| Serialize AST to byte buffer          | 6.32 (±3.23%) | 20           | 158.3500000000 ms | passed |
| Parse string to AST                   | 5.35 (±4.82%) | 17           | 187.0588235294 ms | passed |
| Clone AST to AST with structuredClone | 1.72 (±8.82%) | 9            | 580.0000000000 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size (utf-8)  | 6.13 MB  |
| Parsed filter list size       | 63.69 MB |
| Serialized size               | 7.38 MB  |
| Deserialized filter list size | 52.01 MB |

### webkit 17.4

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Deserialize byte buffer to AST        | 15.15 (±1.73%) | 29           | 66.0000000000 ms  | passed |
| Serialize AST to byte buffer          | 12.43 (±1.42%) | 35           | 80.4571428571 ms  | passed |
| Parse string to AST                   | 9.61 (±2.53%)  | 28           | 104.1071428571 ms | passed |
| Clone AST to AST with structuredClone | 3.17 (±1.92%)  | 12           | 315.6666666667 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size (utf-8)  | 6.13 MB  |
| Parsed filter list size       | 63.69 MB |
| Serialized size               | 7.38 MB  |
| Deserialized filter list size | 52.01 MB |


## uBlock Base List

### Node.js v18.17.1

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime  | Status |
| ------------------------------------- | -------------- | ------------ | ---------------- | ------ |
| Deserialize byte buffer to AST        | 117 (±4.91%)   | 77           | 8.5214163602 ms  | passed |
| Serialize AST to byte buffer          | 79.36 (±0.83%) | 69           | 12.6009222928 ms | passed |
| Parse string to AST                   | 31.01 (±6.58%) | 57           | 32.2430679211 ms | passed |
| Clone AST to AST with structuredClone | 18.49 (±1.87%) | 35           | 54.0890527000 ms | passed |

#### Stats

| Stat                          | Value   |
| ----------------------------- | ------- |
| Raw filter list size (utf-8)  | 0.67 MB |
| Parsed filter list size       | 5.30 MB |
| Serialized size               | 0.75 MB |
| Deserialized filter list size | 4.82 MB |

### chromium 121.0.6167.57

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime  | Status |
| ------------------------------------- | -------------- | ------------ | ---------------- | ------ |
| Serialize AST to byte buffer          | 129 (±0.54%)   | 62           | 7.7290322581 ms  | passed |
| Deserialize byte buffer to AST        | 94.61 (±1.04%) | 56           | 10.5691964286 ms | passed |
| Parse string to AST                   | 88.75 (±1.29%) | 57           | 11.2672305764 ms | passed |
| Clone AST to AST with structuredClone | 19.28 (±3.18%) | 37           | 51.8783783784 ms | passed |

#### Stats

| Stat                          | Value   |
| ----------------------------- | ------- |
| Raw filter list size (utf-8)  | 0.67 MB |
| Parsed filter list size       | 7.12 MB |
| Serialized size               | 0.75 MB |
| Deserialized filter list size | 5.81 MB |

### firefox 121.0

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime  | Status |
| ------------------------------------- | -------------- | ------------ | ---------------- | ------ |
| Deserialize byte buffer to AST        | 63.55 (±2.53%) | 49           | 15.7346938776 ms | passed |
| Serialize AST to byte buffer          | 46.69 (±0.82%) | 50           | 21.4200000000 ms | passed |
| Parse string to AST                   | 36.60 (±4.86%) | 40           | 27.3250000000 ms | passed |
| Clone AST to AST with structuredClone | 16.55 (±2.01%) | 32           | 60.4062500000 ms | passed |

#### Stats

| Stat                          | Value   |
| ----------------------------- | ------- |
| Raw filter list size (utf-8)  | 0.67 MB |
| Parsed filter list size       | 7.12 MB |
| Serialized size               | 0.75 MB |
| Deserialized filter list size | 5.81 MB |

### webkit 17.4

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime  | Status |
| ------------------------------------- | -------------- | ------------ | ---------------- | ------ |
| Deserialize byte buffer to AST        | 119 (±0.77%)   | 57           | 8.4309941520 ms  | passed |
| Serialize AST to byte buffer          | 103 (±0.68%)   | 61           | 9.7336065574 ms  | passed |
| Parse string to AST                   | 75.37 (±1.01%) | 58           | 13.2672413793 ms | passed |
| Clone AST to AST with structuredClone | 27.61 (±1.00%) | 38           | 36.2192982456 ms | passed |

#### Stats

| Stat                          | Value   |
| ----------------------------- | ------- |
| Raw filter list size (utf-8)  | 0.67 MB |
| Parsed filter list size       | 7.12 MB |
| Serialized size               | 0.75 MB |
| Deserialized filter list size | 5.81 MB |

