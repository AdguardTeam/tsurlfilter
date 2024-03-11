# Benchmark results

Report generated on: Thu, 07 Mar 2024 10:18:52 GMT

## System specs

- CPU: Intel Gen Intel® Core™ i9-12900H (20 cores)
- Memory: 15826.45 MB
- OS: Ubuntu 22.04.3 LTS x64
- Node: v18.17.1

> [!NOTE]
> Results are sorted by performance (fastest first).

## EasyList

### Node.js v18.17.1

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 72.97 (±0.88%) | 76           | 13.7043843947 ms  | passed |
| Deserialize byte buffer to AST        | 16.00 (±9.83%) | 31           | 62.5032442581 ms  | passed |
| Parse string to AST                   | 9.69 (±7.05%)  | 28           | 103.2350555357 ms | passed |
| Clone AST to AST with structuredClone | 4.52 (±5.93%)  | 16           | 221.4806896875 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size (utf-8)  | 1.70 MB  |
| Parsed filter list size       | 19.92 MB |
| Serialized size               | 2.78 MB  |
| Deserialized filter list size | 16.18 MB |

### chromium 121.0.6167.57

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 72.50 (±0.81%) | 55           | 13.7939393939 ms  | passed |
| Deserialize byte buffer to AST        | 23.99 (±3.02%) | 34           | 41.6862745098 ms  | passed |
| Parse string to AST                   | 15.27 (±3.53%) | 30           | 65.4833333333 ms  | passed |
| Clone AST to AST with structuredClone | 5.34 (±2.04%)  | 16           | 187.1875000000 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size (utf-8)  | 1.70 MB  |
| Parsed filter list size       | 25.84 MB |
| Serialized size               | 2.78 MB  |
| Deserialized filter list size | 20.88 MB |

### firefox 121.0

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Deserialize byte buffer to AST        | 12.30 (±2.96%) | 25           | 81.3200000000 ms  | passed |
| Serialize AST to byte buffer          | 12.17 (±1.03%) | 34           | 82.1470588235 ms  | passed |
| Parse string to AST                   | 12.02 (±3.35%) | 24           | 83.1875000000 ms  | passed |
| Clone AST to AST with structuredClone | 4.10 (±7.57%)  | 14           | 243.7142857143 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size (utf-8)  | 1.70 MB  |
| Parsed filter list size       | 25.84 MB |
| Serialized size               | 2.78 MB  |
| Deserialized filter list size | 20.88 MB |

### webkit 17.4

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 95.70 (±0.99%) | 57           | 10.4495614035 ms  | passed |
| Parse string to AST                   | 20.34 (±1.79%) | 38           | 49.1710526316 ms  | passed |
| Deserialize byte buffer to AST        | 19.19 (±1.56%) | 36           | 52.0972222222 ms  | passed |
| Clone AST to AST with structuredClone | 7.18 (±1.90%)  | 22           | 139.3181818182 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size (utf-8)  | 1.70 MB  |
| Parsed filter list size       | 25.84 MB |
| Serialized size               | 2.78 MB  |
| Deserialized filter list size | 20.88 MB |


## AdGuard Base List

### Node.js v18.17.1

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 25.55 (±1.23%) | 47           | 39.1358180106 ms  | passed |
| Deserialize byte buffer to AST        | 5.51 (±9.14%)  | 18           | 181.4448500556 ms | passed |
| Parse string to AST                   | 3.53 (±6.65%)  | 13           | 283.4597949231 ms | passed |
| Clone AST to AST with structuredClone | 1.88 (±7.84%)  | 9            | 532.1399477778 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size (utf-8)  | 6.09 MB  |
| Parsed filter list size       | 46.70 MB |
| Serialized size               | 7.32 MB  |
| Deserialized filter list size | 36.41 MB |

### chromium 121.0.6167.57

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 25.47 (±0.89%) | 47           | 39.2659574468 ms  | passed |
| Deserialize byte buffer to AST        | 8.38 (±7.69%)  | 24           | 119.3333333333 ms | passed |
| Parse string to AST                   | 5.81 (±5.62%)  | 19           | 172.1052631579 ms | passed |
| Clone AST to AST with structuredClone | 1.71 (±1.24%)  | 9            | 585.7777777778 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size (utf-8)  | 6.09 MB  |
| Parsed filter list size       | 63.30 MB |
| Serialized size               | 7.32 MB  |
| Deserialized filter list size | 47.79 MB |

### firefox 121.0

#### Benchmark results

| Action                                | Ops/s         | Runs sampled | Average runtime   | Status |
| ------------------------------------- | ------------- | ------------ | ----------------- | ------ |
| Deserialize byte buffer to AST        | 4.90 (±8.85%) | 16           | 203.9375000000 ms | passed |
| Serialize AST to byte buffer          | 4.58 (±2.09%) | 16           | 218.3750000000 ms | passed |
| Parse string to AST                   | 4.54 (±5.49%) | 16           | 220.5000000000 ms | passed |
| Clone AST to AST with structuredClone | 1.64 (±9.77%) | 9            | 608.7777777778 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size (utf-8)  | 6.09 MB  |
| Parsed filter list size       | 63.30 MB |
| Serialized size               | 7.32 MB  |
| Deserialized filter list size | 47.79 MB |

### webkit 17.4

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 32.06 (±1.33%) | 44           | 31.1893939394 ms  | passed |
| Parse string to AST                   | 7.84 (±2.65%)  | 24           | 127.6250000000 ms | passed |
| Deserialize byte buffer to AST        | 6.38 (±3.14%)  | 21           | 156.6666666667 ms | passed |
| Clone AST to AST with structuredClone | 2.77 (±3.69%)  | 11           | 360.7272727273 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size (utf-8)  | 6.09 MB  |
| Parsed filter list size       | 63.30 MB |
| Serialized size               | 7.32 MB  |
| Deserialized filter list size | 47.79 MB |


## uBlock Base List

### Node.js v18.17.1

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime  | Status |
| ------------------------------------- | -------------- | ------------ | ---------------- | ------ |
| Serialize AST to byte buffer          | 162 (±1.58%)   | 84           | 6.1667822363 ms  | passed |
| Deserialize byte buffer to AST        | 52.20 (±7.95%) | 49           | 19.1585096871 ms | passed |
| Parse string to AST                   | 27.69 (±3.98%) | 50           | 36.1205868300 ms | passed |
| Clone AST to AST with structuredClone | 15.79 (±2.39%) | 43           | 63.3298570698 ms | passed |

#### Stats

| Stat                          | Value   |
| ----------------------------- | ------- |
| Raw filter list size (utf-8)  | 0.67 MB |
| Parsed filter list size       | 5.31 MB |
| Serialized size               | 0.75 MB |
| Deserialized filter list size | 4.17 MB |

### chromium 121.0.6167.57

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime  | Status |
| ------------------------------------- | -------------- | ------------ | ---------------- | ------ |
| Serialize AST to byte buffer          | 221 (±0.62%)   | 65           | 4.5321266968 ms  | passed |
| Deserialize byte buffer to AST        | 85.23 (±1.72%) | 51           | 11.7328431373 ms | passed |
| Parse string to AST                   | 46.73 (±1.70%) | 50           | 21.4000000000 ms | passed |
| Clone AST to AST with structuredClone | 18.22 (±2.63%) | 35           | 54.8714285714 ms | passed |

#### Stats

| Stat                          | Value   |
| ----------------------------- | ------- |
| Raw filter list size (utf-8)  | 0.67 MB |
| Parsed filter list size       | 7.14 MB |
| Serialized size               | 0.75 MB |
| Deserialized filter list size | 5.45 MB |

### firefox 121.0

#### Benchmark results

| Action                                | Ops/s           | Runs sampled | Average runtime  | Status |
| ------------------------------------- | --------------- | ------------ | ---------------- | ------ |
| Serialize AST to byte buffer          | 67.52 (±0.97%)  | 52           | 14.8108974359 ms | passed |
| Deserialize byte buffer to AST        | 44.39 (±10.90%) | 35           | 22.5285714286 ms | passed |
| Parse string to AST                   | 28.33 (±12.05%) | 32           | 35.3020833333 ms | passed |
| Clone AST to AST with structuredClone | 16.12 (±1.40%)  | 31           | 62.0161290323 ms | passed |

#### Stats

| Stat                          | Value   |
| ----------------------------- | ------- |
| Raw filter list size (utf-8)  | 0.67 MB |
| Parsed filter list size       | 7.14 MB |
| Serialized size               | 0.75 MB |
| Deserialized filter list size | 5.45 MB |

### webkit 17.4

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime  | Status |
| ------------------------------------- | -------------- | ------------ | ---------------- | ------ |
| Serialize AST to byte buffer          | 281 (±1.02%)   | 61           | 3.5599774236 ms  | passed |
| Deserialize byte buffer to AST        | 64.54 (±1.24%) | 49           | 15.4938775510 ms | passed |
| Parse string to AST                   | 57.09 (±1.15%) | 51           | 17.5156862745 ms | passed |
| Clone AST to AST with structuredClone | 25.57 (±1.71%) | 36           | 39.1018518519 ms | passed |

#### Stats

| Stat                          | Value   |
| ----------------------------- | ------- |
| Raw filter list size (utf-8)  | 0.67 MB |
| Parsed filter list size       | 7.14 MB |
| Serialized size               | 0.75 MB |
| Deserialized filter list size | 5.45 MB |

