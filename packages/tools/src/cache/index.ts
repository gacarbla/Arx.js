import { Container } from "./container";
import { Memory } from "./memory";
import "./config"

export { Memory }
export { Container }
export type { NodeContainerType, MemoryAccessor } from "./types";

export const CACHE = {
    Memory,
    Container
}

export default Memory