import { constants, copyFileSync, renameSync, rmSync } from "node:fs";

export const backupFileOps = {
  copyExclusive(source: string, destination: string) {
    copyFileSync(source, destination, constants.COPYFILE_EXCL);
  },
  rename(source: string, destination: string) {
    renameSync(source, destination);
  },
  remove(path: string) {
    rmSync(path);
  },
};
