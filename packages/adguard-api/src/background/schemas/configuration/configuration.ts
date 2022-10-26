import zod from "zod";

export const configurationValidator = zod.object({
    filters: zod.number().array(),
    whitelist: zod.string().array().optional(),
    blacklist: zod.string().array().optional(),
    rules: zod.string().array().optional(),
    filtersMetadataUrl: zod.string(),
    filterRulesUrl: zod.string(),
});

export type Configuration = zod.infer<typeof configurationValidator>;
