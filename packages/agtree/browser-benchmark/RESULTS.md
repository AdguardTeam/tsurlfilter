# Benchmark results

Report generated on: Mon, 26 Feb 2024 15:40:27 GMT

## System specs

- CPU: Intel Gen Intel® Core™ i9-12900K (24 cores)
- Memory: 31967.53 MB
- OS: Ubuntu 22.04.2 LTS x64
- Node: v18.17.1

> [!NOTE]
> Results are sorted by performance (fastest first).

## EasyList

### chromium 121.0.6167.57

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 74.90 (±0.48%) | 57           | 13.3508771930 ms  | passed |
| Deserialize byte buffer to AST        | 29.18 (±3.74%) | 41           | 34.2682926829 ms  | passed |
| Parse string to AST                   | 17.15 (±1.68%) | 33           | 58.3030303030 ms  | passed |
| Clone AST to AST with structuredClone | 5.97 (±1.33%)  | 18           | 167.3888888889 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 1.69 MB  |
| Parsed filter list size       | 25.79 MB |
| Serialized size               | 2.77 MB  |
| Deserialized filter list size | 20.85 MB |

### firefox 121.0

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 12.64 (±0.99%) | 36           | 79.1388888889 ms  | passed |
| Deserialize byte buffer to AST        | 12.58 (±4.84%) | 26           | 79.5192307692 ms  | passed |
| Parse string to AST                   | 12.43 (±7.95%) | 25           | 80.4800000000 ms  | passed |
| Clone AST to AST with structuredClone | 4.35 (±5.52%)  | 15           | 229.9333333333 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 1.69 MB  |
| Parsed filter list size       | 25.79 MB |
| Serialized size               | 2.77 MB  |
| Deserialized filter list size | 20.85 MB |

### webkit 17.4

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 97.79 (±0.88%) | 58           | 10.2262931034 ms  | passed |
| Parse string to AST                   | 21.30 (±1.17%) | 39           | 46.9487179487 ms  | passed |
| Deserialize byte buffer to AST        | 19.92 (±1.08%) | 37           | 50.1891891892 ms  | passed |
| Clone AST to AST with structuredClone | 7.77 (±1.78%)  | 24           | 128.6250000000 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 1.69 MB  |
| Parsed filter list size       | 25.79 MB |
| Serialized size               | 2.77 MB  |
| Deserialized filter list size | 20.85 MB |


## AdGuard Base List

### chromium 121.0.6167.57

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 26.66 (±0.96%) | 37           | 37.5045045045 ms  | passed |
| Deserialize byte buffer to AST        | 11.12 (±8.41%) | 31           | 89.9032258065 ms  | passed |
| Parse string to AST                   | 6.24 (±5.91%)  | 20           | 160.3000000000 ms | passed |
| Clone AST to AST with structuredClone | 1.88 (±0.61%)  | 10           | 532.7000000000 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 6.07 MB  |
| Parsed filter list size       | 63.19 MB |
| Serialized size               | 7.31 MB  |
| Deserialized filter list size | 47.73 MB |

### firefox 121.0

#### Benchmark results

| Action                                | Ops/s         | Runs sampled | Average runtime   | Status |
| ------------------------------------- | ------------- | ------------ | ----------------- | ------ |
| Deserialize byte buffer to AST        | 5.54 (±7.28%) | 18           | 180.6666666667 ms | passed |
| Parse string to AST                   | 4.77 (±5.58%) | 16           | 209.8125000000 ms | passed |
| Serialize AST to byte buffer          | 4.71 (±1.37%) | 16           | 212.3750000000 ms | passed |
| Clone AST to AST with structuredClone | 1.76 (±8.26%) | 9            | 569.1111111111 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 6.07 MB  |
| Parsed filter list size       | 63.19 MB |
| Serialized size               | 7.31 MB  |
| Deserialized filter list size | 47.73 MB |

### webkit 17.4

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 33.17 (±1.09%) | 45           | 30.1481481481 ms  | passed |
| Parse string to AST                   | 8.32 (±3.12%)  | 25           | 120.2000000000 ms | passed |
| Deserialize byte buffer to AST        | 7.03 (±2.57%)  | 22           | 142.2272727273 ms | passed |
| Clone AST to AST with structuredClone | 3.21 (±3.25%)  | 13           | 311.7692307692 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 6.07 MB  |
| Parsed filter list size       | 63.19 MB |
| Serialized size               | 7.31 MB  |
| Deserialized filter list size | 47.73 MB |


## uBlock Base List

### chromium 121.0.6167.57

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime  | Status |
| ------------------------------------- | -------------- | ------------ | ---------------- | ------ |
| Serialize AST to byte buffer          | 225 (±0.53%)   | 63           | 4.4501504305 ms  | passed |
| Deserialize byte buffer to AST        | 107 (±1.42%)   | 57           | 9.3764619883 ms  | passed |
| Parse string to AST                   | 52.03 (±2.58%) | 47           | 19.2202127660 ms | passed |
| Clone AST to AST with structuredClone | 19.41 (±2.85%) | 37           | 51.5135135135 ms | passed |

#### Stats

| Stat                          | Value   |
| ----------------------------- | ------- |
| Raw filter list size          | 0.68 MB |
| Parsed filter list size       | 7.25 MB |
| Serialized size               | 0.76 MB |
| Deserialized filter list size | 5.53 MB |

### firefox 121.0

#### Benchmark results

| Action                                | Ops/s           | Runs sampled | Average runtime  | Status |
| ------------------------------------- | --------------- | ------------ | ---------------- | ------ |
| Serialize AST to byte buffer          | 44.31 (±0.85%)  | 48           | 22.5677083333 ms | passed |
| Deserialize byte buffer to AST        | 37.73 (±6.42%)  | 41           | 26.5060975610 ms | passed |
| Parse string to AST                   | 29.86 (±10.76%) | 34           | 33.4950980392 ms | passed |
| Clone AST to AST with structuredClone | 15.32 (±1.84%)  | 29           | 65.2586206897 ms | passed |

#### Stats

| Stat                          | Value   |
| ----------------------------- | ------- |
| Raw filter list size          | 0.68 MB |
| Parsed filter list size       | 7.25 MB |
| Serialized size               | 0.76 MB |
| Deserialized filter list size | 5.53 MB |

### webkit 17.4

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime  | Status |
| ------------------------------------- | -------------- | ------------ | ---------------- | ------ |
| Serialize AST to byte buffer          | 284 (±1.30%)   | 62           | 3.5231416550 ms  | passed |
| Deserialize byte buffer to AST        | 66.61 (±0.85%) | 51           | 15.0130718954 ms | passed |
| Parse string to AST                   | 61.62 (±0.69%) | 55           | 16.2290909091 ms | passed |
| Clone AST to AST with structuredClone | 27.27 (±1.14%) | 38           | 36.6666666667 ms | passed |

#### Stats

| Stat                          | Value   |
| ----------------------------- | ------- |
| Raw filter list size          | 0.68 MB |
| Parsed filter list size       | 7.25 MB |
| Serialized size               | 0.76 MB |
| Deserialized filter list size | 5.53 MB |

