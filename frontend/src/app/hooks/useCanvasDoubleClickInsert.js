import { useCallback } from "react";

export function useCanvasDoubleClickInsert({
  tool,
  toW,
  dispatch,
  uid,
  getNextStickySwatch,
}) {
  const onDblClick = useCallback((e) => {
    if (tool === "select" && !e.target.closest("[data-node]")) {
      const { x, y } = toW(e.clientX, e.clientY);
      const sc = getNextStickySwatch();
      dispatch({
        type: "ADD",
        node: {
          id: uid(),
          type: "sticky",
          x: x - 85,
          y: y - 65,
          w: 170,
          h: 130,
          text: "",
          color: sc.bg,
          textColor: sc.t,
        },
      });
    }
  }, [dispatch, getNextStickySwatch, toW, tool, uid]);

  return {
    onDblClick,
  };
}
