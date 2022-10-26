import zod, { z } from "zod";

export const filterMetadataValidator = zod.object({
    description: zod.string(),
    displayNumber: zod.number(),
    expires: zod.number(),
    filterId: zod.number(),
    groupId: zod.number(),
    homepage: zod.string(),
    languages: zod.string().array(),
    name: zod.string(),
    subscriptionUrl: zod.string(),
    tags: zod.number().array(),
    timeAdded: zod.string(),
    timeUpdated: zod.string(),
    trustLevel: zod.string(),
    version: zod.string(),
});

export type FilterMetadata = z.infer<typeof filterMetadataValidator>;
