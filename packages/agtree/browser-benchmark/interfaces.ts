import { type ParserOptions } from '../src/parser/options';

export interface FilterList {
    name: string;
    url: string;
    raw?: string;
}

export interface BenchmarkConfig {
    iterations: number;
    filterLists: FilterList[];
    parserOptions: ParserOptions;
}
