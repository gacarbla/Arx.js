import { FileManager, type MappedMemoryTree } from "./filemanager"
import { Helper as FileManagerHelper } from "./helper"
import { Directory, File, SynchronizedDirectory } from "./models"
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