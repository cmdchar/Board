import { useCallback } from "react";

export function useCanvasContextImageUpload({
  dispatch,
  uid,
  ctxUploadPosRef,
  notify,
}) {
  const onCtxUploadImage = useCallback((e) => {
    const f = e.target.files?.[0];
    if (!f) {
      e.target.value = "";
      return;
    }
    const pos = ctxUploadPosRef.current || { wx: 0, wy: 0 };
    const r2 = new FileReader();
    r2.onload = (ev) => {
      dispatch({
        type: "ADD",
        node: {
          id: uid(),
          type: "image",
          src: ev.target.result,
          x: pos.wx - 150,
          y: pos.wy - 100,
          w: 300,
          h: 200,
        },
      });
      notify?.("Image added", "success");
    };
    r2.readAsDataURL(f);
    e.target.value = "";
    ctxUploadPosRef.current = null;
  }, [ctxUploadPosRef, dispatch, notify, uid]);

  return {
    onCtxUploadImage,
  };
}
