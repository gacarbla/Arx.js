export interface RoleData {
    id: string;
    name: string;
    color: number;
    hoist: boolean;
    position: number;
    permissions: string;
    managed: boolean;
    mentionable: boolean;
    icon?: string | null;
    unicodeEmoji?: string | null;
}

export class Role {
    readonly id: string;
    readonly name: string;
    readonly color: number;
    readonly hoist: boolean;
    readonly position: number;
    readonly permissions: string;
    readonly managed: boolean;
    readonly mentionable: boolean;
    readonly icon?: string | null;
    readonly unicodeEmoji?: string | null;

    constructor(data: RoleData) {
        this.id = data.id;
        this.name = data.name;
        this.color = data.color;
        this.hoist = Boolean(data.hoist);
        this.position = data.position;
        this.permissions = data.permissions;
        this.managed = Boolean(data.managed);
        this.mentionable = Boolean(data.mentionable);
        this.icon = data.icon ?? null;
        this.unicodeEmoji = data.unicodeEmoji ?? null;

        Object.freeze(this);
    }

    get mention(): string {
        return `<@&${this.id}>`;
    }

    get hexColor(): string {
        return `#${this.color.toString(16).padStart(6, "0")}`;
    }

    toString(): string {
        return this.mention;
    }

    toJSON(): RoleData {
        return {
            id: this.id,
            name: this.name,
            color: this.color,
            hoist: this.hoist,
            position: this.position,
            permissions: this.permissions,
            managed: this.managed,
            mentionable: this.mentionable,
            icon: this.icon,
            unicodeEmoji: this.unicodeEmoji
        };
    }
}