export type EventMap = Record<string, any[]>;

/** Small typed event emitter used by the gateway (no untyped EventEmitter). */
export class TypedEmitter<Events extends { [K in keyof Events]: any[] }> {
    private readonly listeners = new Map<keyof Events, Set<(...args: any[]) => void>>();

    public on<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this {
        let set = this.listeners.get(event);
        if (!set) {
            set = new Set();
            this.listeners.set(event, set);
        }
        set.add(listener);
        return this;
    }

    public once<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this {
        const wrapper = (...args: Events[K]) => {
            this.off(event, wrapper);
            listener(...args);
        };
        return this.on(event, wrapper);
    }

    public off<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this {
        this.listeners.get(event)?.delete(listener);
        return this;
    }

    public emit<K extends keyof Events>(event: K, ...args: Events[K]): boolean {
        const set = this.listeners.get(event);
        if (!set || set.size === 0) return false;

        for (const listener of [...set]) {
            try {
                listener(...args);
            } catch (error) {
                // Listener failures must not break the gateway loop. Consumers
                // can listen to "error" if they want to observe them.
                if ((event as string) !== "error") {
                    (this.emit as (event: string, ...args: any[]) => boolean)("error", error);
                }
            }
        }
        return true;
    }

    public removeAllListeners(event?: keyof Events): this {
        if (event === undefined) {
            this.listeners.clear();
        } else {
            this.listeners.delete(event);
        }
        return this;
    }

    public listenerCount(event: keyof Events): number {
        return this.listeners.get(event)?.size ?? 0;
    }
}
