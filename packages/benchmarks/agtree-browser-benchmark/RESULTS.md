# Benchmark results

Report generated on: Tue, 03 Feb 2026 07:12:31 GMT

## System specs

- CPU: Apple M3 Max (14 cores)
- Memory: 36864.00 MB
- OS: macOS 26.2 arm64
- Node: v22.20.0

> [!NOTE]
> Results are sorted by performance (fastest first).

## EasyList

### Node.js v22.20.0

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Parse string to AST                   | 17.29 (±2.18%) | 47           | 57.8443865532 ms  | passed |
| Clone AST to AST with structuredClone | 5.68 (±0.73%)  | 18           | 176.2106503889 ms | passed |

#### Stats

| Stat                         | Value    |
| ---------------------------- | -------- |
| Raw filter list size (utf-8) | 2.03 MB  |
| Parsed filter list size      | 22.63 MB |

### chromium 136.0.7103.25

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Parse string to AST                   | 25.99 (±2.29%) | 36           | 38.4722222222 ms  | passed |
| Clone AST to AST with structuredClone | 8.44 (±3.05%)  | 25           | 118.4400000000 ms | passed |

#### Stats

| Stat                         | Value    |
| ---------------------------- | -------- |
| Raw filter list size (utf-8) | 2.03 MB  |
| Parsed filter list size      | 29.44 MB |

### firefox 137.0

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Parse string to AST                   | 14.86 (±2.97%) | 29           | 67.2931034483 ms  | passed |
| Clone AST to AST with structuredClone | 5.57 (±2.47%)  | 18           | 179.6666666667 ms | passed |

#### Stats

| Stat                         | Value    |
| ---------------------------- | -------- |
| Raw filter list size (utf-8) | 2.03 MB  |
| Parsed filter list size      | 29.44 MB |

### webkit 18.4

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime   | Status |
| ------------------------------------- | -------------- | ------------ | ----------------- | ------ |
| Parse string to AST                   | 21.76 (±4.19%) | 34           | 45.9509803922 ms  | passed |
| Clone AST to AST with structuredClone | 7.10 (±0.83%)  | 22           | 140.8636363636 ms | passed |

#### Stats

| Stat                         | Value    |
| ---------------------------- | -------- |
| Raw filter list size (utf-8) | 2.03 MB  |
| Parsed filter list size      | 29.44 MB |


## AdGuard Base List

### Node.js v22.20.0

#### Benchmark results

| Action                                | Ops/s         | Runs sampled | Average runtime   | Status |
| ------------------------------------- | ------------- | ------------ | ----------------- | ------ |
| Parse string to AST                   | 5.68 (±2.46%) | 19           | 176.1839386316 ms | passed |
| Clone AST to AST with structuredClone | 2.44 (±0.82%) | 10           | 410.4332626000 ms | passed |

#### Stats

| Stat                         | Value    |
| ---------------------------- | -------- |
| Raw filter list size (utf-8) | 7.04 MB  |
| Parsed filter list size      | 53.35 MB |

### chromium 136.0.7103.25

#### Benchmark results

| Action                                | Ops/s         | Runs sampled | Average runtime   | Status |
| ------------------------------------- | ------------- | ------------ | ----------------- | ------ |
| Parse string to AST                   | 9.49 (±2.86%) | 28           | 105.3928571429 ms | passed |
| Clone AST to AST with structuredClone | 3.20 (±0.26%) | 13           | 312.6153846154 ms | passed |

#### Stats

| Stat                         | Value    |
| ---------------------------- | -------- |
| Raw filter list size (utf-8) | 7.04 MB  |
| Parsed filter list size      | 72.51 MB |

### firefox 137.0

#### Benchmark results

| Action                                | Ops/s         | Runs sampled | Average runtime   | Status |
| ------------------------------------- | ------------- | ------------ | ----------------- | ------ |
| Parse string to AST                   | 5.70 (±3.47%) | 19           | 175.5263157895 ms | passed |
| Clone AST to AST with structuredClone | 2.43 (±3.59%) | 11           | 410.8181818182 ms | passed |

#### Stats

| Stat                         | Value    |
| ---------------------------- | -------- |
| Raw filter list size (utf-8) | 7.04 MB  |
| Parsed filter list size      | 72.51 MB |

### webkit 18.4

#### Benchmark results

| Action                                | Ops/s         | Runs sampled | Average runtime   | Status |
| ------------------------------------- | ------------- | ------------ | ----------------- | ------ |
| Parse string to AST                   | 7.51 (±4.60%) | 23           | 133.1739130435 ms | passed |
| Clone AST to AST with structuredClone | 2.78 (±1.20%) | 11           | 360.1818181818 ms | passed |

#### Stats

| Stat                         | Value    |
| ---------------------------- | -------- |
| Raw filter list size (utf-8) | 7.04 MB  |
| Parsed filter list size      | 72.51 MB |


## uBlock Base List

### Node.js v22.20.0

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime  | Status |
| ------------------------------------- | -------------- | ------------ | ---------------- | ------ |
| Parse string to AST                   | 81.40 (±0.74%) | 71           | 12.2855463289 ms | passed |
| Clone AST to AST with structuredClone | 36.89 (±0.86%) | 65           | 27.1062387846 ms | passed |

#### Stats

| Stat                         | Value   |
| ---------------------------- | ------- |
| Raw filter list size (utf-8) | 0.46 MB |
| Parsed filter list size      | 3.70 MB |

### chromium 136.0.7103.25

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime  | Status |
| ------------------------------------- | -------------- | ------------ | ---------------- | ------ |
| Parse string to AST                   | 140 (±1.08%)   | 63           | 7.1380471380 ms  | passed |
| Clone AST to AST with structuredClone | 52.55 (±0.90%) | 48           | 19.0291666667 ms | passed |

#### Stats

| Stat                         | Value   |
| ---------------------------- | ------- |
| Raw filter list size (utf-8) | 0.46 MB |
| Parsed filter list size      | 4.96 MB |

### firefox 137.0

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime  | Status |
| ------------------------------------- | -------------- | ------------ | ---------------- | ------ |
| Parse string to AST                   | 77.46 (±2.10%) | 52           | 12.9093406593 ms | passed |
| Clone AST to AST with structuredClone | 35.58 (±0.46%) | 49           | 28.1020408163 ms | passed |

#### Stats

| Stat                         | Value   |
| ---------------------------- | ------- |
| Raw filter list size (utf-8) | 0.46 MB |
| Parsed filter list size      | 4.96 MB |

### webkit 18.4

#### Benchmark results

| Action                                | Ops/s          | Runs sampled | Average runtime  | Status |
| ------------------------------------- | -------------- | ------------ | ---------------- | ------ |
| Parse string to AST                   | 126 (±1.35%)   | 57           | 7.9161616162 ms  | passed |
| Clone AST to AST with structuredClone | 41.87 (±0.39%) | 46           | 23.8858695652 ms | passed |

#### Stats

| Stat                         | Value   |
| ---------------------------- | ------- |
| Raw filter list size (utf-8) | 0.46 MB |
| Parsed filter list size      | 4.96 MB |

