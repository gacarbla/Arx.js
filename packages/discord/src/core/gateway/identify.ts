/**
 * Serializes IDENTIFY payloads so a bot never exceeds Discord's identify rate
 * limit. The manager configures the interval from `max_concurrency`.
 */
export class IdentifyThrottle {
    private lastIdentifyAt = Number.NEGATIVE_INFINITY;
    private chain: Promise<void> = Promise.resolve();

    constructor(
        private readonly intervalMs: number,
        private readonly now: () => number,
        private readonly sleep: (ms: number) => Promise<void>
    ) {}

    public acquire(): Promise<void> {
        const next = this.chain.then(async () => {
            const wait = Math.max(0, this.lastIdentifyAt + this.intervalMs - this.now());
            if (wait > 0) await this.sleep(wait);
            this.lastIdentifyAt = this.now();
        });

        // A failed acquire must not poison the queue for later shards.
        this.chain = next.catch(() => undefined);
        return next;
    }
}
