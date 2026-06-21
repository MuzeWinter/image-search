import type { ServiceDescriptor, ServiceStatus } from "./types";

class ServiceRegistry {
  private services = new Map<string, ServiceDescriptor>();

  register(desc: ServiceDescriptor): void {
    if (this.services.has(desc.name)) {
      throw new Error(`Service "${desc.name}" already registered`);
    }
    this.services.set(desc.name, { ...desc, status: "idle" });
  }

  get(name: string): ServiceDescriptor | undefined {
    return this.services.get(name);
  }

  getStatus(name: string): ServiceStatus {
    return this.services.get(name)?.status ?? "idle";
  }

  async ensureReady(name: string): Promise<ServiceDescriptor> {
    const svc = this.services.get(name);
    if (!svc) {
      throw new Error(`Service "${name}" not registered`);
    }

    if (svc.status === "ready") return svc;
    if (svc.status === "starting") {
      // Wait for the starting service — poll until ready or error
      return new Promise((resolve, reject) => {
        const check = () => {
          const s = this.services.get(name);
          if (!s) return reject(new Error(`Service "${name}" disappeared`));
          if (s.status === "ready") return resolve(s);
          if (s.status === "error") return reject(new Error(`Service "${name}" failed to start`));
          setTimeout(check, 50);
        };
        setTimeout(check, 50);
      });
    }

    // idle or error → start
    svc.status = "starting";
    try {
      await svc.start();
      svc.status = "ready";
      return svc;
    } catch (e) {
      svc.status = "error";
      throw e;
    }
  }

  async shutdown(): Promise<void> {
    for (const [, svc] of this.services) {
      if (svc.stop && svc.status === "ready") {
        try {
          await svc.stop();
        } catch {
          // ignore stop errors during shutdown
        }
      }
    }
    this.services.clear();
  }
}

export const serviceRegistry = new ServiceRegistry();
