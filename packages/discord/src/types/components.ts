import type { APIMessageComponent, APIModalComponent } from "discord-api-types/v10";

/**
 * Numeric component types used by Discord API v10.
 *
 * Kept as a local const object (instead of importing the runtime enum from
 * `discord-api-types`) so the package has no runtime dependency on it.
 */
export const ComponentType = {
    ActionRow: 1,
    Button: 2,
    StringSelect: 3,
    TextInput: 4,
    UserSelect: 5,
    RoleSelect: 6,
    MentionableSelect: 7,
    ChannelSelect: 8,
    Section: 9,
    TextDisplay: 10,
    Thumbnail: 11,
    MediaGallery: 12,
    File: 13,
    Separator: 14,
    Container: 17,
    Label: 18,
    FileUpload: 19,
    RadioGroup: 21,
    CheckboxGroup: 22,
    Checkbox: 23,
} as const;

export type ComponentType = (typeof ComponentType)[keyof typeof ComponentType];

/** Components that require the `IS_COMPONENTS_V2` message flag. */
export const V2_COMPONENT_TYPES: ReadonlySet<ComponentType> = new Set<ComponentType>([
    ComponentType.Section,
    ComponentType.TextDisplay,
    ComponentType.Thumbnail,
    ComponentType.MediaGallery,
    ComponentType.File,
    ComponentType.Separator,
    ComponentType.Container,
]);

/** Components that may appear inside a `Container`. */
export const CONTAINER_CHILD_TYPES: ReadonlySet<ComponentType> = new Set<ComponentType>([
    ComponentType.ActionRow,
    ComponentType.TextDisplay,
    ComponentType.Section,
    ComponentType.MediaGallery,
    ComponentType.Separator,
    ComponentType.File,
]);

/** Components that may appear inside a `Label` (modals). */
export const LABEL_CHILD_TYPES: ReadonlySet<ComponentType> = new Set<ComponentType>([
    ComponentType.TextInput,
    ComponentType.StringSelect,
    ComponentType.UserSelect,
    ComponentType.RoleSelect,
    ComponentType.MentionableSelect,
    ComponentType.ChannelSelect,
    ComponentType.FileUpload,
    ComponentType.RadioGroup,
    ComponentType.CheckboxGroup,
    ComponentType.Checkbox,
]);

/** Components that may appear inside a message `ActionRow`. */
export const MESSAGE_ACTION_ROW_CHILD_TYPES: ReadonlySet<ComponentType> = new Set<ComponentType>([
    ComponentType.Button,
    ComponentType.StringSelect,
    ComponentType.UserSelect,
    ComponentType.RoleSelect,
    ComponentType.MentionableSelect,
    ComponentType.ChannelSelect,
]);

/** Components that may be used as a `Section` accessory. */
export const SECTION_ACCESSORY_TYPES: ReadonlySet<ComponentType> = new Set<ComponentType>([
    ComponentType.Button,
    ComponentType.Thumbnail,
]);

/** Components accepted at the top level of a message. */
export const MESSAGE_TOP_LEVEL_TYPES: ReadonlySet<ComponentType> = new Set<ComponentType>([
    ComponentType.ActionRow,
    ComponentType.Section,
    ComponentType.TextDisplay,
    ComponentType.MediaGallery,
    ComponentType.File,
    ComponentType.Separator,
    ComponentType.Container,
]);

export type ComponentPayload = APIMessageComponent | APIModalComponent;

/**
 * Fluent button styles.
 *
 * `Premium` maps to the SKU button style (6) and is not general-purpose.
 */
export type ButtonStyle = "Primary" | "Secondary" | "Success" | "Danger" | "Link" | "Premium";

export const ButtonStyleValue: Readonly<Record<ButtonStyle, number>> = Object.freeze({
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4,
    Link: 5,
    Premium: 6,
});

export type TextInputStyle = "Short" | "Paragraph";

export const TextInputStyleValue: Readonly<Record<TextInputStyle, number>> = Object.freeze({
    Short: 1,
    Paragraph: 2,
});

export type SeparatorSpacing = "Small" | "Large";

export const SeparatorSpacingValue: Readonly<Record<SeparatorSpacing, number>> = Object.freeze({
    Small: 1,
    Large: 2,
});

export interface SelectOption {
    label: string;
    value: string;
    description?: string;
    emoji?: { id?: string; name?: string; animated?: boolean };
    default?: boolean;
}

export interface RadioGroupOption {
    label: string;
    value: string;
    description?: string;
    default?: boolean;
}

export interface EmbedField {
    name: string;
    value: string;
    inline?: boolean;
}

export interface EmbedFooter {
    text: string;
    icon_url?: string;
    proxy_icon_url?: string;
}

export interface EmbedProvider {
    name?: string;
    url?: string;
}

export interface EmbedAuthor {
    name: string;
    url?: string;
    icon_url?: string;
    proxy_icon_url?: string;
}

export interface EmbedImage {
    url: string;
    proxy_url?: string;
    height?: number;
    width?: number;
}

/**
 * Application command option types.
 *
 * Official names (`String`, `Integer`, ...) are the primary API. The
 * SCREAMING_SNAKE names are kept as aliases for backwards compatibility with
 * the first alpha.
 */
export const ApplicationCommandOptionType = {
    Subcommand: 1,
    SubcommandGroup: 2,
    String: 3,
    Integer: 4,
    Boolean: 5,
    User: 6,
    Channel: 7,
    Role: 8,
    Mentionable: 9,
    Number: 10,
    Attachment: 11,

    SUB_COMMAND: 1,
    SUB_COMMAND_GROUP: 2,
    STRING: 3,
    INTEGER: 4,
    BOOLEAN: 5,
    USER: 6,
    CHANNEL: 7,
    ROLE: 8,
    MENTIONABLE: 9,
    NUMBER: 10,
    ATTACHMENT: 11,
} as const;

export type ApplicationCommandOptionType =
    (typeof ApplicationCommandOptionType)[keyof typeof ApplicationCommandOptionType];

export interface CommandOptionChoice {
    name: string;
    value: string | number;
}
