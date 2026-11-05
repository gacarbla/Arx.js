import type { APIGuildMember } from "discord-api-types/v10";
import { memberKey } from "../../cache/updaters";
import type { StructureClient } from "../Structure";
import { Member } from "../Member";

export class GuildMemberManager {
    constructor(
        private readonly client: StructureClient,
        private readonly guildId: string
    ) {}

    /** Cached members keyed by user id. */
    public get cache(): ReadonlyMap<string, Member> {
        const result = new Map<string, Member>();

        for (const [key, raw] of this.client.cache.members) {
            if (key.startsWith(`${this.guildId}:`)) {
                result.set(raw.user.id, new Member(this.client, this.guildId, raw));
            }
        }

        return result;
    }

    public get(userId: string): Member | undefined {
        const raw = this.client.cache.members.get(memberKey(this.guildId, userId));
        return raw ? new Member(this.client, this.guildId, raw) : undefined;
    }

    public async fetch(userId: string): Promise<Member> {
        const raw = await this.client.rest.get<APIGuildMember>(
            `/guilds/${this.guildId}/members/${userId}`
        );
        this.client.cache.members.set(memberKey(this.guildId, userId), raw);
        return new Member(this.client, this.guildId, raw);
    }

    public async list(options: { limit?: number; after?: string } = {}): Promise<Member[]> {
        const query = new URLSearchParams();
        query.set("limit", String(options.limit ?? 1000));
        if (options.after) query.set("after", options.after);

        const raw = await this.client.rest.get<APIGuildMember[]>(
            `/guilds/${this.guildId}/members?${query.toString()}`
        );

        return raw.map((member) => {
            this.client.cache.members.set(memberKey(this.guildId, member.user.id), member);
            return new Member(this.client, this.guildId, member);
        });
    }
}
