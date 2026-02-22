/**
 * Resource pools for workflow concurrency.
 * Limits parallel execution by node class to prevent cost spikes and rate-limit failures.
 */

export type ResourceClass = "llm" | "http" | "image" | "cpu";

const DEFAULT_POOL_LIMITS: Record<ResourceClass, number> = {
  llm: 2,
  http: 4,
  image: 1,
  cpu: 4,
};

const SPEC_TO_RESOURCE: Record<string, ResourceClass> = {
  "openai-chat": "llm",
  "openai-embeddings": "llm",
  "openai-image": "image",
  "http-request": "http",
  "input": "cpu",
  "merge": "cpu",
  "output": "cpu",
  "merge-json": "cpu",
  "template": "cpu",
  "map": "cpu",
  "json-parse": "cpu",
  "condition": "cpu",
  "delay": "cpu",
  "loop": "cpu",
};

export function getResourceClass(specId: string): ResourceClass {
  return SPEC_TO_RESOURCE[specId] ?? "cpu";
}

export function getPoolLimit(resourceClass: ResourceClass, limits?: Partial<Record<ResourceClass, number>>): number {
  if (limits && typeof limits[resourceClass] === "number") {
    return limits[resourceClass]!;
  }
  return DEFAULT_POOL_LIMITS[resourceClass];
}

type Resolver = () => void;

export function createResourcePoolManager(limits?: Partial<Record<ResourceClass, number>>) {
  const waitQueues: Record<ResourceClass, Resolver[]> = {
    llm: [],
    http: [],
    image: [],
    cpu: [],
  };
  const active: Record<ResourceClass, number> = {
    llm: 0,
    http: 0,
    image: 0,
    cpu: 0,
  };

  return {
    async acquire(resourceClass: ResourceClass): Promise<void> {
      const limit = getPoolLimit(resourceClass, limits);
      if (active[resourceClass] < limit) {
        active[resourceClass]++;
        return;
      }
      await new Promise<void>((resolve) => {
        waitQueues[resourceClass].push(() => {
          active[resourceClass]++;
          resolve();
        });
      });
    },
    release(resourceClass: ResourceClass): void {
      active[resourceClass]--;
      const next = waitQueues[resourceClass].shift();
      if (next) next();
    },
  };
}
