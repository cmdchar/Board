import { useCallback, useRef, useState } from "react";

export function useCanvasLaserTrail({ toW }) {
  const laserTrail = useRef([]);
  const [laserPts, setLaserPts] = useState([]);

  const appendLaserPoint = useCallback((clientX, clientY) => {
    const { x, y } = toW(clientX, clientY);
    const now = Date.now();
    laserTrail.current = [...laserTrail.current.filter((p) => now - p.t < 800), { x, y, t: now }];
    setLaserPts([...laserTrail.current]);
  }, [toW]);

  return {
    laserPts,
    appendLaserPoint,
  };
}
