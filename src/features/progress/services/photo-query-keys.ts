export const photoKeys = {
  root: (owner: string) => ['progress-photos', owner] as const,
  list: (owner: string) => [...photoKeys.root(owner), 'gallery'] as const,
  detail: (owner: string, id: string) => [...photoKeys.root(owner), 'photo', id] as const,
  url: (owner: string, id: string, thumbnail: boolean) => [...photoKeys.root(owner), 'url', id, thumbnail] as const,
  comparisons: (owner: string) => [...photoKeys.root(owner), 'compare'] as const,
  compare: (owner: string, first: string, second: string) => [...photoKeys.comparisons(owner), ...[first, second].sort()] as const,
};
