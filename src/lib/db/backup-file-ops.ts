import {
  closeSync,
  constants,
  copyFileSync,
  fstatSync,
  openSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";

export type FileIdentity = { dev: bigint; ino: bigint };

export const backupFileOps = {
  afterReserve(path: string) {
    void path;
  },
  beforeCopy(source: string, destination: string) {
    void source;
    void destination;
  },
  afterCopy(source: string, destination: string) {
    void source;
    void destination;
  },
  beforeRename(source: string, destination: string) {
    void source;
    void destination;
  },
  beforeRemove(path: string) {
    void path;
  },
  reserve(path: string): FileIdentity {
    const descriptor = openSync(path, "wx");
    try {
      const stats = fstatSync(descriptor, { bigint: true });
      return { dev: stats.dev, ino: stats.ino };
    } finally {
      closeSync(descriptor);
    }
  },
  owns(path: string, identity: FileIdentity) {
    try {
      const stats = statSync(path, { bigint: true });
      return stats.dev === identity.dev && stats.ino === identity.ino;
    } catch {
      return false;
    }
  },
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
