import { useEffect, useRef, useState } from "react";
import { createEmptyDataFlowRuntime, runDataFlowEngine } from "../lib/dataflow/engine";

export function useDataFlowEngine({ nodes = [], arrows = [], dispatch }) {
  const [runtime, setRuntime] = useState(() => createEmptyDataFlowRuntime());
  const prevRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let timerId = null;
    let idleId = null;

    const commit = () => {
      const result = runDataFlowEngine({
        nodes,
        arrows,
        previous: prevRef.current,
      });
      prevRef.current = result.state;
      if (cancelled) return;
      setRuntime(result.runtime || createEmptyDataFlowRuntime());
      const deltas = result.nodePatches && typeof result.nodePatches === "object" ? result.nodePatches : {};
      if (dispatch && Object.keys(deltas).length) {
        dispatch({ type: "UPD_MULTI", deltas });
      }
    };

    timerId = window.setTimeout(() => {
      if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(() => commit(), { timeout: 180 });
        return;
      }
      commit();
    }, 0);

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
      if (typeof window !== "undefined" && idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [arrows, dispatch, nodes]);

  return runtime;
}
