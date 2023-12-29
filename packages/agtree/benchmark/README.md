# Adblock Filter List Parser Benchmark

This benchmark serves as a tool for evaluating the performance of Adblock Filter List parsers.

The benchmark results can be found in [`benchmark/RESULTS.md`][results].

## Usage

Build AGTree in the parent directory:

```sh
yarn build
```

Then run the benchmark, simply execute the following command in this directory:

```sh
yarn start
```

The results will be displayed on the console and saved in [`benchmark/RESULTS.md`][results].

> [!NOTE]
> Please be aware that the benchmark may take several minutes to complete.

## Supported parsers

You can find the list of supported tools in [`config/tools.ts`][tools-config].

## Adding a new tool / resource

To incorporate a new tool or resource, follow these steps:

1. Open the appropriate configuration file:
    - To add a new tool, edit [`config/tools.ts`][tools-config].
    - For adding a new resource, access [`config/resources.ts`][resources-config].
2. Create a new entry, ensuring that it follows the same format as existing entries in the respective file.

[resources-config]: ./config/resources.ts
[results]: ./RESULTS.md
[tools-config]: ./config/tools.ts
