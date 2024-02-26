# Benchmark results

Report generated on: Mon, 26 Feb 2024 15:29:52 GMT

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

| Action | Ops/s           | Runs sampled | Average runtime   | Status |
| ------ | --------------- | ------------ | ----------------- | ------ |
|        | 25.77 (±0.66%)  | 47           | 38.8085106383 ms  | passed |
|        | 10.70 (±10.02%) | 31           | 93.4193548387 ms  | passed |
|        | 6.49 (±5.36%)   | 21           | 154.1428571429 ms | passed |
|        | 1.87 (±0.66%)   | 10           | 534.5000000000 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 6.07 MB  |
| Parsed filter list size       | 63.19 MB |
| Serialized size               | 7.31 MB  |
| Deserialized filter list size | 47.73 MB |

### firefox 121.0

#### Benchmark results

| Action | Ops/s          | Runs sampled | Average runtime   | Status |
| ------ | -------------- | ------------ | ----------------- | ------ |
|        | 7.41 (±1.50%)  | 23           | 135.0434782609 ms | passed |
|        | 5.26 (±14.05%) | 17           | 190.1176470588 ms | passed |
|        | 4.76 (±3.59%)  | 16           | 209.8750000000 ms | passed |
|        | 1.73 (±7.08%)  | 9            | 577.1111111111 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 6.07 MB  |
| Parsed filter list size       | 63.19 MB |
| Serialized size               | 7.31 MB  |
| Deserialized filter list size | 47.73 MB |

### webkit 17.4

#### Benchmark results

| Action | Ops/s          | Runs sampled | Average runtime   | Status |
| ------ | -------------- | ------------ | ----------------- | ------ |
|        | 32.99 (±0.72%) | 45           | 30.3111111111 ms  | passed |
|        | 8.49 (±2.45%)  | 26           | 117.7692307692 ms | passed |
|        | 7.04 (±2.14%)  | 22           | 142.0454545455 ms | passed |
|        | 3.16 (±1.64%)  | 12           | 316.0833333333 ms | passed |

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

| Action | Ops/s          | Runs sampled | Average runtime   | Status |
| ------ | -------------- | ------------ | ----------------- | ------ |
|        | 74.14 (±0.48%) | 57           | 13.4883040936 ms  | passed |
|        | 28.37 (±3.06%) | 40           | 35.2500000000 ms  | passed |
|        | 16.96 (±2.67%) | 33           | 58.9696969697 ms  | passed |
|        | 5.99 (±1.05%)  | 18           | 167.0555555556 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 1.69 MB  |
| Parsed filter list size       | 25.79 MB |
| Serialized size               | 2.77 MB  |
| Deserialized filter list size | 20.85 MB |

### firefox 121.0

#### Benchmark results

| Action | Ops/s          | Runs sampled | Average runtime   | Status |
| ------ | -------------- | ------------ | ----------------- | ------ |
|        | 12.54 (±0.64%) | 35           | 79.7428571429 ms  | passed |
|        | 12.38 (±5.60%) | 26           | 80.7692307692 ms  | passed |
|        | 11.98 (±7.17%) | 25           | 83.4400000000 ms  | passed |
|        | 4.19 (±6.58%)  | 15           | 238.4000000000 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 1.69 MB  |
| Parsed filter list size       | 25.79 MB |
| Serialized size               | 2.77 MB  |
| Deserialized filter list size | 20.85 MB |

### webkit 17.4

#### Benchmark results

| Action | Ops/s          | Runs sampled | Average runtime   | Status |
| ------ | -------------- | ------------ | ----------------- | ------ |
|        | 96.86 (±0.80%) | 57           | 10.3245614035 ms  | passed |
|        | 21.10 (±1.05%) | 40           | 47.4000000000 ms  | passed |
|        | 20.07 (±1.05%) | 38           | 49.8289473684 ms  | passed |
|        | 7.77 (±1.93%)  | 24           | 128.6250000000 ms | passed |

#### Stats

| Stat                          | Value    |
| ----------------------------- | -------- |
| Raw filter list size          | 1.69 MB  |
| Parsed filter list size       | 25.79 MB |
| Serialized size               | 2.77 MB  |
| Deserialized filter list size | 20.85 MB |

