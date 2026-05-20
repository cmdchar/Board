import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function SubMenuLayer({ item, anchor, T, onPick, onCloseSoon, onCancelClose }) {
  if (!item || !Array.isArray(item.subMenu) || !item.subMenu.length) return null;
  const left = Math.max(8, anchor.x);
  const top = Math.max(8, Math.min(anchor.y, window.innerHeight - 320));

  return createPortal(
    <div
      className="pop"
      onMouseEnter={onCancelClose}
      onMouseLeave={onCloseSoon}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      style={{
        position: "fixed",
        left,
        top,
        minWidth: 196,
        maxWidth: 260,
        maxHeight: Math.min(420, window.innerHeight - 16),
        overflowY: "auto",
        background: `linear-gradient(165deg, ${T.bg2}, ${T.bg1})`,
        border: `1px solid ${T.b2}`,
        borderRadius: 12,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        padding: 6,
        boxShadow: "0 18px 42px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.05)",
        zIndex: 1500,
      }}
    >
      {(item.subMenu || []).map((subGroup, gi) => (
        <div key={subGroup.id} style={{ paddingTop: gi ? 8 : 0, marginTop: gi ? 8 : 0, borderTop: gi ? `1px solid ${T.b0}` : "none" }}>
          {subGroup.label && <div style={{ padding: "0 8px 4px", fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".08em" }}>{subGroup.label}</div>}
          {subGroup.items.map(subItem => (
            <button
              key={subItem.id}
              disabled={subItem.enabled === false}
              onClick={e => {
                e.stopPropagation();
                if (subItem.enabled === false) return;
                onPick(subItem);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "transparent",
                border: "none",
                color: subItem.enabled === false ? T.t2 : (subItem.danger ? T.red : T.t0),
                opacity: subItem.enabled === false ? 0.72 : 1,
                padding: "7px 8px",
                borderRadius: 7,
                fontSize: 11.5,
                cursor: subItem.enabled === false ? "not-allowed" : "pointer",
                textAlign: "left",
                fontFamily: "inherit",
                transition: "all var(--ui-motion-fast,120ms) var(--ui-ease-out,cubic-bezier(0.22,1,0.36,1))",
              }}
              onMouseEnter={e => {
                if (subItem.enabled !== false) e.currentTarget.style.background = T.bg3;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <span style={{ width: 14, display: "inline-flex", justifyContent: "center", color: subItem.enabled === false ? T.t2 : (subItem.danger ? T.red : T.t1), fontSize: 11, flexShrink: 0 }}>{subItem.icon || "*"}</span>
              <span style={{ flex: 1 }}>{subItem.label}</span>
              {subItem.shortcut && <span style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>{subItem.shortcut}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>,
    document.body,
  );
}

function GroupBlock({ group, T, onPick }) {
  const [openSubId, setOpenSubId] = useState("");
  const [subAnchor, setSubAnchor] = useState({ x: 0, y: 0 });
  const closeTimerRef = useRef(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const closeSoon = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpenSubId(""), 120);
  };

  useEffect(() => () => clearCloseTimer(), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {group.label && <div style={{ padding: "0 10px 5px", fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".08em" }}>{group.label}</div>}
      {group.items.map(item => {
        const hasSub = Array.isArray(item.subMenu) && item.subMenu.length > 0;
        const disabled = item.enabled === false;
        const subOpen = hasSub && openSubId === item.id;

        return (
          <div key={item.id} style={{ position: "relative" }} onMouseLeave={() => { if (hasSub) closeSoon(); }}>
            <button
              disabled={disabled}
              onClick={e => {
                e.stopPropagation();
                if (disabled) return;
                if (hasSub) {
                  setOpenSubId(v => (v === item.id ? "" : item.id));
                  return;
                }
                onPick(item);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "transparent",
                border: "none",
                color: disabled ? T.t2 : (item.danger ? T.red : T.t0),
                opacity: disabled ? 0.72 : 1,
                padding: "8px 10px",
                borderRadius: 8,
                fontSize: 12,
                cursor: disabled ? "not-allowed" : "pointer",
                textAlign: "left",
                fontFamily: "inherit",
                transition: "all var(--ui-motion-fast,120ms) var(--ui-ease-out,cubic-bezier(0.22,1,0.36,1))",
              }}
              onMouseEnter={e => {
                if (hasSub) {
                  clearCloseTimer();
                  const r = e.currentTarget.getBoundingClientRect();
                  setSubAnchor({ x: r.right + 6, y: r.top });
                  setOpenSubId(item.id);
                }
                if (!disabled) e.currentTarget.style.background = T.bg3;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <span style={{ width: 16, display: "inline-flex", justifyContent: "center", color: disabled ? T.t2 : (item.danger ? T.red : T.t1), fontSize: 12, flexShrink: 0 }}>{item.icon || "*"}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
              {item.shortcut && <span style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap" }}>{item.shortcut}</span>}
              {hasSub && <span style={{ fontSize: 12, color: T.t2, paddingLeft: 4 }}>&gt;</span>}
            </button>
            {subOpen && <SubMenuLayer item={item} anchor={subAnchor} T={T} onPick={onPick} onCloseSoon={closeSoon} onCancelClose={clearCloseTimer} />}
          </div>
        );
      })}
    </div>
  );
}

export default function ContextMenu({ menu, position, maxHeight, onClose, T }) {
  const ref = useRef(null);

  useEffect(() => {
    const onDown = e => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    const onKey = e => {
      if (e.key === "Escape") onClose?.();
    };

    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!Array.isArray(menu) || !menu.length) return null;

  return (
    <div
      ref={ref}
      className="pop"
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      style={{
        position: "absolute",
        left: position?.x || 0,
        top: position?.y || 0,
        background: `linear-gradient(165deg, ${T.bg2}, ${T.bg1})`,
        border: `1px solid ${T.b2}`,
        borderRadius: 14,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        padding: "8px 8px 6px",
        zIndex: 999,
        width: 292,
        maxHeight: maxHeight || 520,
        overflowY: "auto",
        overflowX: "visible",
        boxShadow: "0 20px 52px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.05)",
      }}
    >
      {menu.map((group, gi) => (
        <div key={group.id} style={{ paddingTop: gi ? 8 : 0, marginTop: gi ? 8 : 0, borderTop: gi ? `1px solid ${T.b0}` : "none" }}>
          <GroupBlock
            group={group}
            T={T}
            onPick={item => {
              if (item.enabled === false) return;
              item.onSelect?.();
              onClose?.();
            }}
          />
        </div>
      ))}
    </div>
  );
}
