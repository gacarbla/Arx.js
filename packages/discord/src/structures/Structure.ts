import type { CacheStore } from "../cache/CacheStore";
import type { RestLike } from "../core/rest/RestClient";
import type { User } from "./User";

/**
 * Minimal client contract required by structures.
 *
 * `Bot` implements it, and tests can provide a small fake.
 */
export interface StructureClient {
    readonly rest: RestLike;
    readonly cache: CacheStore;
    readonly user: User | null;
    readonly applicationId: string | null;
}

/** Base class for lazy views over raw API payloads. */
export abstract class Structure<T> {
    constructor(
        public readonly client: StructureClient,
        public raw: T
    ) {}

    /** Returns the raw API payload. */
    public toJSON(): T {
        return this.raw;
    }
}
