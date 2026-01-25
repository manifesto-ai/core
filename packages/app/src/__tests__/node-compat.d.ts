// Minimal node:* module types for test compilation without @types/node.

declare module "node:fs" {
  export interface Dirent {
    readonly name: string;
    isDirectory(): boolean;
    isFile(): boolean;
  }

  interface FsModule {
    readdirSync(path: string, opts: { withFileTypes: true }): Dirent[];
    readFileSync(path: string, encoding: "utf8"): string;
  }

  const fs: FsModule;
  export = fs;
}

declare module "node:path" {
  interface PathModule {
    resolve(...segments: string[]): string;
    dirname(path: string): string;
    join(...segments: string[]): string;
  }

  const path: PathModule;
  export = path;
}

declare module "node:url" {
  export function fileURLToPath(url: URL | string): string;
}
