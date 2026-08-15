export class Container<K = any, V = any> {
    private store = new Map<K, V>();

    add<T extends V = V>(key: K, value: T): T | undefined {
        this.store.set(key, value);
        return this.get(key);
    }

    set<T extends V = V>(key: K, value: T): T | undefined {
        this.store.set(key, value);
        return this.get(key);
    }

    get<T extends V = V>(key: K): T | undefined {
        return this.store.get(key) as T | undefined;
    }

    getAll(): Map<K, V> {
        return new Map<K, V>(this.store);
    }

    getAllEntries(): [K, V][] {
        return Array.from(this.store.entries());
    }

    getAllAsObject(): Record<Extract<K, PropertyKey>, V> {
        return Object.fromEntries(this.store) as Record<Extract<K, PropertyKey>, V>;
    }
}