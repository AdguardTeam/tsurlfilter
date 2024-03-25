# CSS Tokenizer benchmark

This benchmark serves as a tool for evaluating the performance of CSS Tokenizers.

The benchmark results can be found in [`benchmark/RESULTS.md`][results].

## Usage

To run the benchmark, simply execute the following command:

```sh
pnpm benchmark
```

This command will build the library and initiate the benchmark. The results will be displayed on the console and saved
in [`benchmark/RESULTS.md`][results].

> [!NOTE]
> Please be aware that the benchmark may take several minutes to complete.

## Supported tokenizers

You can find the list of supported tokenizers in [`config/tokenizers.ts`][tokenizers-config].

We exclusively support tokenizers that adhere to the [CSS Syntax specification][css-specs]. For example, PostCSS is not
included in this benchmark because it utilizes a custom token set, making it difficult to perform a fair comparison with
other tokenizers.

## Adding a new tokenizer / resource

To incorporate a new tokenizer or resource, follow these steps:

1. Open the appropriate configuration file:
    - To add a new tokenizer, edit [`config/tokenizers.ts`][tokenizers-config].
    - For adding a new resource, access [`config/resources.ts`][resources-config].
2. Create a new entry, ensuring that it follows the same format as existing entries in the respective file.

[css-specs]: https://www.w3.org/TR/css-syntax-3/
[resources-config]: ./config/resources.ts
[results]: ./RESULTS.md
[tokenizers-config]: ./config/tokenizers.ts
