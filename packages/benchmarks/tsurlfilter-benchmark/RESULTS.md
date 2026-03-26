# Benchmark results

Report generated on: Wed, 03 Dec 2025 18:14:02 GMT

## System specs

- CPU: Apple M3 Max (14 cores)
- Memory: 36864.00 MB
- OS: macOS 15.6.1 arm64
- Node: v22.20.0

> [!NOTE]
> Results are sorted by performance (fastest first).

## EasyList

### Node.js v22.20.0

#### Benchmark results

| Task                         | Hz (ops/s) | Mean (ms) | Min (ms) | Max (ms) | P75 (ms) | P99 (ms) | P995 (ms) | P999 (ms) | RME (%) | Samples | Status |
| ---------------------------- | ---------- | --------- | -------- | -------- | -------- | -------- | --------- | --------- | ------- | ------- | ------ |
| Create tsurlfilter v4 engine | 19.29      | 52.1079   | 49.6558  | 66.4845  | 51.5010  | 65.8395  | 66.1620   | 66.4200   | 1.66    | 64      | passed |
| Create tsurlfilter v3 engine | 14.84      | 67.5095   | 65.1493  | 80.3846  | 67.2838  | 79.1449  | 79.7648   | 80.2606   | 0.99    | 64      | passed |

#### Stats

| Stat                         | Value |
| ---------------------------- | ----- |
| Rules count (tsurlfilter v4) | 77119 |
| Rules count (tsurlfilter v3) | 77112 |

### chromium 136.0.7103.25

#### Benchmark results

| Task                         | Hz (ops/s) | Mean (ms) | Min (ms) | Max (ms) | P75 (ms) | P99 (ms) | P995 (ms) | P999 (ms) | RME (%) | Samples | Status |
| ---------------------------- | ---------- | --------- | -------- | -------- | -------- | -------- | --------- | --------- | ------- | ------- | ------ |
| Create tsurlfilter v4 engine | 23.67      | 42.3656   | 40.7000  | 57.3000  | 42.4000  | 51.7560  | 54.5280   | 56.7456   | 1.16    | 64      | passed |
| Create tsurlfilter v3 engine | 13.89      | 72.0734   | 68.4000  | 83.3000  | 73.3000  | 80.5280  | 81.9140   | 83.0228   | 0.83    | 64      | passed |

#### Stats

| Stat                         | Value |
| ---------------------------- | ----- |
| Rules count (tsurlfilter v4) | 77119 |
| Rules count (tsurlfilter v3) | 77112 |

### firefox 137.0

#### Benchmark results

| Task                         | Hz (ops/s) | Mean (ms) | Min (ms) | Max (ms) | P75 (ms) | P99 (ms) | P995 (ms) | P999 (ms) | RME (%) | Samples | Status |
| ---------------------------- | ---------- | --------- | -------- | -------- | -------- | -------- | --------- | --------- | ------- | ------- | ------ |
| Create tsurlfilter v4 engine | 12.43      | 80.6875   | 73.0000  | 92.0000  | 84.2500  | 90.7400  | 91.3700   | 91.8740   | 1.30    | 64      | passed |
| Create tsurlfilter v3 engine | 8.69       | 115.1875  | 112.0000 | 128.0000 | 115.0000 | 127.3700 | 127.6850  | 127.9370  | 0.77    | 64      | passed |

#### Stats

| Stat                         | Value |
| ---------------------------- | ----- |
| Rules count (tsurlfilter v4) | 77119 |
| Rules count (tsurlfilter v3) | 77112 |

### webkit 18.4

#### Benchmark results

| Task                         | Hz (ops/s) | Mean (ms) | Min (ms) | Max (ms) | P75 (ms) | P99 (ms) | P995 (ms) | P999 (ms) | RME (%) | Samples | Status |
| ---------------------------- | ---------- | --------- | -------- | -------- | -------- | -------- | --------- | --------- | ------- | ------- | ------ |
| Create tsurlfilter v4 engine | 20.33      | 49.2969   | 45.0000  | 55.0000  | 51.0000  | 54.3700  | 54.6850   | 54.9370   | 1.22    | 64      | passed |
| Create tsurlfilter v3 engine | 10.64      | 94.0469   | 88.0000  | 100.0000 | 96.0000  | 99.3700  | 99.6850   | 99.9370   | 0.69    | 64      | passed |

#### Stats

| Stat                         | Value |
| ---------------------------- | ----- |
| Rules count (tsurlfilter v4) | 77119 |
| Rules count (tsurlfilter v3) | 77112 |


## AdGuard Base List

### Node.js v22.20.0

#### Benchmark results

| Task                         | Hz (ops/s) | Mean (ms) | Min (ms) | Max (ms) | P75 (ms) | P99 (ms) | P995 (ms) | P999 (ms) | RME (%) | Samples | Status |
| ---------------------------- | ---------- | --------- | -------- | -------- | -------- | -------- | --------- | --------- | ------- | ------- | ------ |
| Create tsurlfilter v4 engine | 9.55       | 105.0453  | 99.9741  | 132.7692 | 104.1824 | 126.2527 | 129.5109  | 132.1175  | 1.34    | 64      | passed |
| Create tsurlfilter v3 engine | 4.90       | 204.2626  | 199.0449 | 225.6396 | 204.4634 | 225.1091 | 225.3744  | 225.5865  | 0.73    | 64      | passed |

#### Stats

| Stat                         | Value  |
| ---------------------------- | ------ |
| Rules count (tsurlfilter v4) | 132977 |
| Rules count (tsurlfilter v3) | 132960 |

### chromium 136.0.7103.25

#### Benchmark results

| Task                         | Hz (ops/s) | Mean (ms) | Min (ms) | Max (ms) | P75 (ms) | P99 (ms) | P995 (ms) | P999 (ms) | RME (%) | Samples | Status |
| ---------------------------- | ---------- | --------- | -------- | -------- | -------- | -------- | --------- | --------- | ------- | ------- | ------ |
| Create tsurlfilter v4 engine | 11.76      | 85.1313   | 82.2000  | 100.1000 | 85.2500  | 95.8790  | 97.9895   | 99.6779   | 0.75    | 64      | passed |
| Create tsurlfilter v3 engine | 4.68       | 213.5891  | 205.9000 | 224.4000 | 216.1000 | 223.2030 | 223.8015  | 224.2803  | 0.45    | 64      | passed |

#### Stats

| Stat                         | Value  |
| ---------------------------- | ------ |
| Rules count (tsurlfilter v4) | 132977 |
| Rules count (tsurlfilter v3) | 132960 |

### firefox 137.0

#### Benchmark results

| Task                         | Hz (ops/s) | Mean (ms) | Min (ms) | Max (ms) | P75 (ms) | P99 (ms) | P995 (ms) | P999 (ms) | RME (%) | Samples | Status |
| ---------------------------- | ---------- | --------- | -------- | -------- | -------- | -------- | --------- | --------- | ------- | ------- | ------ |
| Create tsurlfilter v4 engine | 6.47       | 154.7969  | 145.0000 | 172.0000 | 159.2500 | 168.8500 | 170.4250  | 171.6850  | 0.95    | 64      | passed |
| Create tsurlfilter v3 engine | 3.21       | 311.3906  | 305.0000 | 337.0000 | 313.2500 | 330.7000 | 333.8500  | 336.3700  | 0.51    | 64      | passed |

#### Stats

| Stat                         | Value  |
| ---------------------------- | ------ |
| Rules count (tsurlfilter v4) | 132977 |
| Rules count (tsurlfilter v3) | 132960 |

### webkit 18.4

#### Benchmark results

| Task                         | Hz (ops/s) | Mean (ms) | Min (ms) | Max (ms) | P75 (ms) | P99 (ms) | P995 (ms) | P999 (ms) | RME (%) | Samples | Status |
| ---------------------------- | ---------- | --------- | -------- | -------- | -------- | -------- | --------- | --------- | ------- | ------- | ------ |
| Create tsurlfilter v4 engine | 10.10      | 99.2344   | 89.0000  | 116.0000 | 102.0000 | 110.9600 | 113.4800  | 115.4960  | 1.21    | 64      | passed |
| Create tsurlfilter v3 engine | 3.73       | 268.2500  | 254.0000 | 283.0000 | 272.0000 | 281.7400 | 282.3700  | 282.8740  | 0.63    | 64      | passed |

#### Stats

| Stat                         | Value  |
| ---------------------------- | ------ |
| Rules count (tsurlfilter v4) | 132977 |
| Rules count (tsurlfilter v3) | 132960 |

