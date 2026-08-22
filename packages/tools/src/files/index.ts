import { FileManager, type MappedMemoryTree } from "./filemanager"
import { Helper as FileManagerHelper } from "./helper"
export { Directory, File, SynchronizedDirectory } from "./models"
export type * from "./types"
import "./config"

export {
    FileManager,
    type MappedMemoryTree,
    FileManagerHelper
}

export const FILES = {
    Manager: FileManager,
    Helper: FileManagerHelper
}

export default FILES