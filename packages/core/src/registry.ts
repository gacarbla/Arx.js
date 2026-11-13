/**
 * Registry of configuration sections.
 *
 * Feature packages augment this interface through module augmentation:
 *
 * ```ts
 * declare module "@arx.js/core" {
 *     interface ArxConfigRegistry {
 *         DISCORD: typeof DiscordSchema;
 *     }
 * }
 * ```
 *
 * Keeping the declaration in its own module (re-exported from the package
 * entry point) lets TypeScript merge augmentations made against
 * `"@arx.js/core"` with the interface used internally by `Config`.
 */
export interface ArxConfigRegistry {}
