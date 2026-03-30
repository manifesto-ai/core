declare module "node:module" {
  export function createRequire(url: string | URL): (id: string) => unknown;
}
