export class Container<K = any, V = any> {
    private store = new Map<K, V>();

    add<T extends V = V>(key: K, value: T): void {
        this.store.set(key, value);
    }

    set<T extends V = V>(key: K, value: T): void {
        this.store.set(key, value);
    }

    get<T extends V = V>(key: K): T | undefined {
        return this.store.get(key) as T | undefined;
    }
}