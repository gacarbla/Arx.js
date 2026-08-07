import { Container } from "./container";
import { Memory } from "./memory";

export { Memory }
export { Container }
export type { NodeContainerType, MemoryAccessor } from "./types";

export const cache = {
    Memory,
    Container
}