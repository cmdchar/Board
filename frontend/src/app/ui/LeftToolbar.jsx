import RightToolPanel from "../../components/RightToolPanel";

export default function LeftToolbar({ s, d, uid, onOpenTemplates, notify }) {
  return (
    <RightToolPanel
      s={s}
      d={d}
      uid={uid}
      onOpenTemplates={onOpenTemplates}
      notify={notify}
      topOffset={68}
      side="left"
      leftInset={12}
    />
  );
}
