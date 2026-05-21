import RightToolPanel from "../../components/RightToolPanel";

export default function LeftToolbar({ s, d, uid, onOpenTemplates, notify }) {
  return (
    <div style={{ pointerEvents: "none", position: "absolute", inset: 0, zIndex: 240 }}>
      <div style={{ pointerEvents: "auto" }}>
        <RightToolPanel
          s={s}
          d={d}
          uid={uid}
          onOpenTemplates={onOpenTemplates}
          notify={notify}
          topOffset={68}
          side="left"
          leftInset={14}
        />
      </div>
    </div>
  );
}
