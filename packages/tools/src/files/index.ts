/**
 * ==============================================
 * REGISTRO DE LA HERRAMIENTA EN EL CORE
 * ==============================================
 */

import { Config } from "@arx.js/core";
import { z } from "zod";

const FilesSchema = z.object({});

declare module "@arx.js/core" {
    interface ArxConfigRegistry {
        "TOOLS/FILES": typeof FilesSchema;
    }
}

Config.register({
    key: "TOOLS/FILES",
    schema: FilesSchema,
});

// ==============================================

import { FileManager, type MappedMemoryTree } from "./filemanager"
import { Helper as FileManagerHelper } from "./helper"
export { Directory, File, SynchronizedDirectory } from "./models"
export type * from "./types"

export {
    FileManager,
    type MappedMemoryTree,
    FileManagerHelper
}

export const FILE = {
    Manager: FileManager,
    Helper: FileManagerHelper
}

export default FileManager