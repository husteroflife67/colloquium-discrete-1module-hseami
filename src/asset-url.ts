// Source JSON keeps root-relative paths. Resolve them against the deployment base.
export function assetUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}
