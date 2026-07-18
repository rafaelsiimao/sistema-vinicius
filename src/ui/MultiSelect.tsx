import { useEffect, useRef, useState } from "react";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  options: Option[];
  /** Valores selecionados. Array vazio = "Todos". */
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export function MultiSelect({ label, options, selected, onChange, placeholder = "Todos" }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setBusca(""); }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else setBusca("");
  }, [open]);

  const all = selected.length === 0;
  const displayText = all
    ? placeholder
    : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
      : `${selected.length} selecionados`;

  function toggleAll() {
    onChange([]);
  }

  function toggleOption(value: string) {
    if (selected.includes(value)) {
      const next = selected.filter((v) => v !== value);
      onChange(next);
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block", minWidth: 160 }}>
      <label style={{ display: "block", marginBottom: 4, fontSize: 11, color: "var(--tx3)", fontWeight: 600, textTransform: "uppercase" }}>
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          minHeight: 34,
          background: "var(--card2)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          color: all ? "var(--tx3)" : "var(--tx)",
          padding: "0 28px 0 10px",
          textAlign: "left",
          cursor: "pointer",
          fontSize: 13,
          position: "relative",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {displayText}
        <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--tx3)", fontSize: 10 }}>
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 200,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            minWidth: "max(100%, 200px)",
            maxHeight: 300,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)", background: "var(--card2)" }}>
            <input
              ref={inputRef}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar…"
              style={{ width: "100%", fontSize: 12, padding: "4px 8px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--tx)" }}
            />
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {!busca && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 12, color: "var(--tx)", background: "var(--card2)" }}>
                <input type="checkbox" checked={all} onChange={toggleAll} style={{ width: "auto", margin: 0 }} />
                Todos
              </label>
            )}
            {options.filter((o) => !busca || o.label.toLowerCase().includes(busca.toLowerCase())).map((o) => (
              <label
                key={o.value}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12, color: "var(--tx2)", borderBottom: "1px solid var(--border)", background: "var(--card)" }}
              >
                <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggleOption(o.value)} style={{ width: "auto", margin: 0 }} />
                {o.label}
              </label>
            ))}
            {options.filter((o) => !busca || o.label.toLowerCase().includes(busca.toLowerCase())).length === 0 && (
              <div style={{ padding: "8px 12px", color: "var(--tx3)", fontSize: 12 }}>Nenhum resultado.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
