# Benchmark results

Report generated on: Mon, 26 Feb 2024 15:19:57 GMT

## System specs

- CPU: Intel Gen Intel® Core™ i9-12900K (24 cores)
- Memory: 31967.53 MB
- OS: Ubuntu 22.04.2 LTS x64
- Node: v18.17.1

> [!NOTE]
> Results are sorted by performance (fastest first).

## AdGuard Base List

### chromium 121.0.6167.57

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 25.95 (±0.58%) | 47           | 38.5425531915 ms  | passed |
| Deserialize byte buffer to AST        | 11.72 (±4.54%) | 31           | 85.3548387097 ms  | passed |
| Parse string to AST                   | 6.08 (±10.49%) | 20           | 164.3500000000 ms | passed |
| Clone AST to AST with structuredClone | 1.87 (±0.56%)  | 10           | 534.6000000000 ms | passed |

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
| Deserialize byte buffer to AST        | 5.69 (±6.09%) | 18           | 175.7777777778 ms | passed |
| Parse string to AST                   | 4.81 (±5.05%) | 16           | 207.7500000000 ms | passed |
| Serialize AST to byte buffer          | 4.70 (±1.51%) | 16           | 212.6250000000 ms | passed |
| Clone AST to AST with structuredClone | 1.76 (±6.60%) | 9            | 569.1111111111 ms | passed |

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
| Serialize AST to byte buffer          | 32.52 (±0.90%) | 45           | 30.7481481481 ms  | passed |
| Parse string to AST                   | 8.38 (±2.87%)  | 26           | 119.3846153846 ms | passed |
| Deserialize byte buffer to AST        | 7.04 (±2.02%)  | 22           | 142.1363636364 ms | passed |
| Clone AST to AST with structuredClone | 3.19 (±2.02%)  | 12           | 313.4166666667 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 6.07 MB  |
| Parsed filter list size       | 63.19 MB |
| Serialized size               | 7.31 MB  |
| Deserialized filter list size | 47.73 MB |


## EasyList

### chromium 121.0.6167.57

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Serialize AST to byte buffer          | 73.95 (±0.48%) | 57           | 13.5233918129 ms  | passed |
| Deserialize byte buffer to AST        | 29.34 (±3.77%) | 41           | 34.0813008130 ms  | passed |
| Parse string to AST                   | 17.16 (±2.95%) | 33           | 58.2727272727 ms  | passed |
| Clone AST to AST with structuredClone | 6.00 (±0.89%)  | 18           | 166.6111111111 ms | passed |

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
| Deserialize byte buffer to AST        | 12.48 (±4.70%) | 26           | 80.1153846154 ms  | passed |
| Serialize AST to byte buffer          | 12.42 (±0.87%) | 35           | 80.5142857143 ms  | passed |
| Parse string to AST                   | 12.01 (±8.15%) | 25           | 83.2600000000 ms  | passed |
| Clone AST to AST with structuredClone | 4.22 (±5.94%)  | 15           | 236.8000000000 ms | passed |

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
| Serialize AST to byte buffer          | 95.05 (±0.98%) | 56           | 10.5204081633 ms  | passed |
| Parse string to AST                   | 21.33 (±1.18%) | 39           | 46.8846153846 ms  | passed |
| Deserialize byte buffer to AST        | 19.31 (±1.17%) | 36           | 51.7916666667 ms  | passed |
| Clone AST to AST with structuredClone | 7.77 (±1.54%)  | 24           | 128.7083333333 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 1.69 MB  |
| Parsed filter list size       | 25.79 MB |
| Serialized size               | 2.77 MB  |
| Deserialized filter list size | 20.85 MB |

