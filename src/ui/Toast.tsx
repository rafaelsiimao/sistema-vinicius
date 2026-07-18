import { useEffect, useState } from "react";

export interface ToastState {
  msg: string;
  kind: "ok" | "err";
  at: number;
}

export function Toast({ state }: { state: ToastState | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!state) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), state.kind === "err" ? 5000 : 2600);
    return () => clearTimeout(t);
  }, [state]);

  if (!state || !visible) return null;
  return (
    <div className={`toast ${state.kind === "err" ? "toast-err" : "toast-ok"}`} role="status">
      {state.msg}
    </div>
  );
}
