import { useEffect } from "react";

export function useCanvasImageIo({
  wRef,
  toW,
  dispatch,
  uid,
  notify,
  px,
  py,
  zoom,
}) {
  useEffect(() => {
    const el = wRef.current;
    const dragOver = (e) => e.preventDefault();
    const drop = (e) => {
      e.preventDefault();
      const f = [...e.dataTransfer.files].find((file) => file.type.startsWith("image/"));
      if (!f) return;
      const r2 = new FileReader();
      r2.onload = (ev) => {
        const { x, y } = toW(e.clientX, e.clientY);
        dispatch({ type: "ADD", node: { id: uid(), type: "image", src: ev.target.result, x: x - 150, y: y - 100, w: 300, h: 200 } });
      };
      r2.readAsDataURL(f);
    };
    el.addEventListener("dragover", dragOver);
    el.addEventListener("drop", drop);
    return () => {
      el.removeEventListener("dragover", dragOver);
      el.removeEventListener("drop", drop);
    };
  }, [px, py, zoom]);

  useEffect(() => {
    const onPaste = (e) => {
      const items = [...(e.clipboardData?.items || [])];
      const img = items.find((i) => i.type.startsWith("image/"));
      if (!img) return;
      e.preventDefault();
      const blob = img.getAsFile();
      if (!blob) return;
      const r2 = new FileReader();
      r2.onload = (ev) => {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const { x, y } = toW(cx, cy);
        dispatch({ type: "ADD", node: { id: uid(), type: "image", src: ev.target.result, x: x - 150, y: y - 100, w: 300, h: 200 } });
        notify?.("Image pasted from clipboard", "success");
      };
      r2.readAsDataURL(blob);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [px, py, zoom]);
}
