import { useState, useEffect, useCallback, useRef } from "react";
import { serviceRegistry } from "../services/registry";
import type { ServiceQueryResult } from "../services/types";

export function useServiceQuery<T>(
  serviceName: string,
  method: string,
  params?: unknown,
): ServiceQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const paramsKey = JSON.stringify(params);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const svc = await serviceRegistry.ensureReady(serviceName);
      const result = await svc.invoke<T>(method, params);
      if (mountedRef.current) {
        setData(result);
        setLoading(false);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    }
  }, [serviceName, method, paramsKey]);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => {
      mountedRef.current = false;
    };
  }, [fetch]);

  const refetch = useCallback(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch };
}
