export class ResourceRegistry<T extends { id: string }> {
  resources: Map<string, T>;

  constructor() {
    this.resources = new Map();
  }

  register(resource: T): void {
    this.resources.set(resource.id, resource);
  }

  get(id: string): T | undefined {
    return this.resources.get(id);
  }

  has(id: string): boolean {
    return this.resources.has(id);
  }

  getAll(): T[] {
    return Array.from(this.resources.values());
  }
}