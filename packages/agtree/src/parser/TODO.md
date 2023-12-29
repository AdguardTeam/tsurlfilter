# TODO list for the parser

- [ ] Add index.ts in src/parser/ directory and use it for reexport of parser-related stuff
- [ ] More detailed documentation
    - [ ] Explain tolerant mode
    - [ ] Explain each sub-parser
    - [ ] Explain AST structure
- [ ] Add parser options
    - [ ] Add `tokenize` method to each (sub-)parser
    - [x] Toggleable location properties
    - [ ] Adjustable parsing details
- [ ] Memory benchmark, especially for the location properties (compare old and new parser)
- [x] Performance benchmark, especially for zod validation
