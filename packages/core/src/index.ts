import { Config } from "./configBuilder";
import { coreConfig } from "./config";

export type { ArxConfigRegistry } from "./registry";
export type {
    ConfigErrorCallback,
    ConfigWatchCallback,
    GlobalArxConfig,
    LoadOptions,
    ModuleConfigDefinition,
    ReactiveConfig,
} from "./configBuilder/types";

export { Config, coreConfig };
