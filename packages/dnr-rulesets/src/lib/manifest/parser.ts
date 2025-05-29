import zod from 'zod';

/**
 * Creates manifest schema.
 *
 * @returns Manifest runtime validation schema.
 */
function createManifestSchema() {
    return zod.object({
        declarative_net_request: zod.object({
            rule_resources: zod.array(
                zod.object({
                    id: zod.string(),
                    enabled: zod.boolean(),
                }).passthrough(),
            ).optional(),
        }).optional(),
    }).passthrough();
}

/**
 * Partial manifest schema type.
 * Note: This schema is not complete and should be extended with other properties.
 */
export type Manifest = zod.infer<ReturnType<typeof createManifestSchema>>;

/**
 * Api for parsing manifest.
 */
export interface ManifestParserInterface {
    /**
     * Parse manifest data from string.
     *
     * @param input Stringified manifest data.
     *
     * @returns Parsed manifest object.
     *
     * @throws {zod.ZodError} If input data is invalid.
     */
    parse(input: string): Manifest;
};

/**
 * Api for parsing manifest.
 *
 * @see {@link ManifestParserInterface}
 */
export class ManifestParser implements ManifestParserInterface {
    /**
     * Manifest runtime validation schema.
     */
    private schema = createManifestSchema();

    /** @inheritdoc */
    public parse(input: string): Manifest {
        const json = JSON.parse(input);
        return this.schema.parse(json);
    }
}
