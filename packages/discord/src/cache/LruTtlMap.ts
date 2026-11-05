export interface LruTtlOptions {
    /** Maximum entries. `0` disables the map; `undefined` means unlimited. */
    max?: number;
    /** Time-to-live in milliseconds. `0` or `undefined` means no expiry. */
    ttl?: number;
}

interface Entry<V> {
    value: V;
    expiresAt: number;
}

/**
 * Small LRU + TTL map.
 *
 * `get()` refreshes recency, `set()` evicts the oldest entry when `max` is
 * exceeded, and `sweep()` removes expired entries.
 */
export class LruTtlMap<K, V> implements Iterable<[K, V]> {
    private readonly map = new Map<K, Entry<V>>();

    constructor(
        private readonly options: LruTtlOptions = {},
        private readonly now: () => number = () => Date.now()
    ) {}

    public get enabled(): boolean {
        return this.options.max !== 0;
    }

    public get max(): number | undefined {
        return this.options.max;
    }

    public get ttl(): number | undefined {
        return this.options.ttl;
    }

    public get size(): number {
        this.sweep();
        return this.map.size;
    }

    public get(key: K): V | undefined {
        if (!this.enabled) return undefined;

        const entry = this.map.get(key);
        if (!entry) return undefined;

        if (entry.expiresAt <= this.now()) {
            this.map.delete(key);
            return undefined;
        }

        // Refresh recency: delete + set moves the key to the end.
        this.map.delete(key);
        this.map.set(key, entry);
        return entry.value;
    }

    public has(key: K): boolean {
        return this.get(key) !== undefined;
    }

    public set(key: K, value: V): this {
        if (!this.enabled) return this;

        const expiresAt =
            this.options.ttl && this.options.ttl > 0
                ? this.now() + this.options.ttl
                : Number.POSITIVE_INFINITY;

        this.map.delete(key);
        this.map.set(key, { value, expiresAt });

        if (this.options.max !== undefined && this.options.max >= 0) {
            while (this.map.size > this.options.max) {
                const oldest = this.map.keys().next();
                if (oldest.done) break;
                this.map.delete(oldest.value);
            }
        }

        return this;
    }

    public delete(key: K): boolean {
        return this.map.delete(key);
    }

    public clear(): void {
        this.map.clear();
    }

    /** Removes expired entries and returns how many were removed. */
    public sweep(): number {
        const now = this.now();
        let removed = 0;

        for (const [key, entry] of this.map) {
            if (entry.expiresAt <= now) {
                this.map.delete(key);
                removed += 1;
            }
        }

        return removed;
    }

    public keys(): K[] {
        this.sweep();
        return [...this.map.keys()];
    }

    public values(): V[] {
        this.sweep();
        return [...this.map.values()].map((entry) => entry.value);
    }

    public entries(): Array<[K, V]> {
        this.sweep();
        return [...this.map.entries()].map(([key, entry]) => [key, entry.value]);
    }

    public forEach(callback: (value: V, key: K) => void): void {
        for (const [key, value] of this.entries()) {
            callback(value, key);
        }
    }

    public *[Symbol.iterator](): IterableIterator<[K, V]> {
        yield* this.entries();
    }
}
