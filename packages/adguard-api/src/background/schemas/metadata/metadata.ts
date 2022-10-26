import zod from "zod";

import { filterMetadataValidator } from "./filter";
import { tagMetadataValidator } from "./tag";
import { groupMetadataValidator } from "./group";

export const metadataValidator = zod.object({
    filters: filterMetadataValidator.array(),
    groups: groupMetadataValidator.array(),
    tags: tagMetadataValidator.array(),
});

export type Metadata = zod.infer<typeof metadataValidator>;
