import { useMemo, useState } from "react";
import { useData } from "@/store/useData";
import { Modal } from "@/ui/Modal";
import { Kpi } from "@/ui/primitives";
import {
  parcelaVencida,
  totalAReceberCents,
  totalRecebidoCents,
  totalVencidoCents,
} from "@/lib/calc";
import { fmtBRL, reaisToCents, centsToReais } from "@/lib/money";
import { fmtDate, todayISO } from "@/lib/dates";
import { uuid } from "@/lib/id";
import type { Parcela } from "@/types";

export function Faturamento() {
  const { snap, save, remove, toast } = useData();
  const today = todayISO();
  const [receber, setReceber] = useState<Parcela | null>(null);
  const [editing, setEditing] = useState<Parcela | null>(null);
  const [creating, setCreating] = useState(false);
  const [filtro, setFiltro] = useState<"todas" | "a_receber" | "recebida" | "vencida">("todas");

  const nomeProjeto = useMemo(() => {
    const m = new Map(snap.projetos.map((p) => [p.id, p.nome || p.cliente]));
    return (id: string) => m.get(id) ?? id;
  }, [snap.projetos]);

  const parcelas = useMemo(() => {
    const list = [...snap.parcelas].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    return list.filter((p) => {
      if (filtro === "todas") return true;
      if (filtro === "vencida") return parcelaVencida(p, today);
      return p.status === filtro;
    });
  }, [snap.parcelas, filtro, today]);

  function statusBadge(p: Parcela) {
    if (p.status === "recebida") return <span className="badge b-green">Recebida</span>;
    if (p.status === "cancelada") return <span className="badge b-gray">Cancelada</span>;
    if (parcelaVencida(p, today)) return <span className="badge b-red">Vencida</span>;
    return <span className="badge b-amber">A receber</span>;
  }

  return (
    <>
      <div className="page-title">Faturamento</div>
      <div className="page-sub">Parcelas a receber, recebidas e vencidas — por competência</div>

      <div className="kpi-row">
        <Kpi label="Contratado (parcelado)" value={fmtBRL(snap.parcelas.reduce((s, p) => s + (p.status !== "cancelada" ? p.valorCents : 0), 0))} tone="accent" />
        <Kpi label="Recebido" value={fmtBRL(totalRecebidoCents(snap.parcelas))} tone="green" />
        <Kpi label="A receber" value={fmtBRL(totalAReceberCents(snap.parcelas))} tone="amber" />
        <Kpi label="Vencido (não recebido)" value={fmtBRL(totalVencidoCents(snap.parcelas, today))} tone="red" />
      </div>

      <div className="filter-bar">
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Nova parcela
        </button>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
          <option value="todas">Todas</option>
          <option value="a_receber">A receber</option>
          <option value="vencida">Vencidas</option>
          <option value="recebida">Recebidas</option>
        </select>
      </div>

      <div className="tbl-wrap">
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th className="l">Projeto</th>
                <th>Parc.</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Recebido em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {parcelas.map((p) => (
                <tr key={p.id}>
                  <td className="l td-name">{nomeProjeto(p.projetoId)}</td>
                  <td>{p.entrada ? "Entrada" : p.numero}</td>
                  <td>{fmtDate(p.vencimento)}</td>
                  <td className="td-val">{fmtBRL(p.valorCents)}</td>
                  <td>{statusBadge(p)}</td>
                  <td className="muted">{p.recebidoEm ? fmtDate(p.recebidoEm) : "—"}</td>
                  <td>
                    <div className="row-actions">
                      {p.status === "recebida" ? (
                        <button
                          className="btn btn-sm"
                          onClick={() => {
                            void save("parcelas", { ...p, status: "a_receber", recebidoEm: null });
                            toast("Recebimento desfeito");
                          }}
                        >
                          desfazer
                        </button>
                      ) : (
                        <button className="btn btn-sm btn-green" onClick={() => setReceber(p)}>
                          receber
                        </button>
                      )}
                      <button className="btn btn-sm" onClick={() => setEditing(p)}>
                        editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {parcelas.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">
                    Nenhuma parcela para este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="alert alert-blue">
        “Recebido” só conta parcelas efetivamente <b>recebidas</b> (com data de recebimento).
        Vencer o prazo marca a parcela como <b>Vencida</b> — nunca como recebida.
      </div>

      {receber && (
        <ReceberModal
          parcela={receber}
          nome={nomeProjeto(receber.projetoId)}
          onClose={() => setReceber(null)}
          onConfirm={(dataISO) => {
            void save("parcelas", { ...receber, status: "recebida", recebidoEm: dataISO });
            toast("Recebimento registrado");
            setReceber(null);
          }}
        />
      )}

      {(creating || editing) && (
        <ParcelaForm
          parcela={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={(p) => { void save("parcelas", p); toast("Parcela salva"); setCreating(false); setEditing(null); }}
          onDelete={editing ? () => { void remove("parcelas", editing.id); toast("Parcela excluída"); setEditing(null); } : undefined}
        />
      )}
    </>
  );
}

function ReceberModal({
  parcela,
  nome,
  onClose,
  onConfirm,
}: {
  parcela: Parcela;
  nome: string;
  onClose: () => void;
  onConfirm: (dataISO: string) => void;
}) {
  const [data, setData] = useState(todayISO());
  return (
    <Modal
      title="Registrar recebimento"
      subtitle={`${nome} · ${fmtBRL(parcela.valorCents)}`}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-green" onClick={() => onConfirm(data)}>
            Confirmar
          </button>
        </>
      }
    >
      <div className="form-full">
        <label>Data do recebimento</label>
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </div>
    </Modal>
  );
}

function ParcelaForm({
  parcela,
  onClose,
  onSave,
  onDelete,
}: {
  parcela: Parcela | null;
  onClose: () => void;
  onSave: (p: Parcela) => void;
  onDelete?: () => void;
}) {
  const { snap } = useData();
  const [projetoId, setProjetoId] = useState(parcela?.projetoId ?? snap.projetos[0]?.id ?? "");
  const [numero, setNumero] = useState(parcela?.numero ?? 1);
  const [vencimento, setVencimento] = useState(parcela?.vencimento ?? todayISO());
  const [valorReais, setValorReais] = useState(parcela ? String(centsToReais(parcela.valorCents)) : "");
  const [erro, setErro] = useState("");

  function salvar() {
    if (!projetoId) {
      setErro("Selecione o projeto.");
      return;
    }
    onSave({
      id: parcela?.id ?? uuid(),
      projetoId,
      numero,
      vencimento,
      valorCents: reaisToCents(valorReais || "0"),
      status: parcela?.status ?? "a_receber",
      recebidoEm: parcela?.recebidoEm ?? null,
      entrada: parcela?.entrada ?? false,
    });
  }

  return (
    <Modal
      title={parcela ? "Editar parcela" : "Nova parcela"}
      onClose={onClose}
      actions={
        <>
          {onDelete && (
            <button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={onDelete}>
              Excluir
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={salvar}>
            Salvar
          </button>
        </>
      }
    >
      <div className="form-full">
        <label>Projeto</label>
        <select value={projetoId} onChange={(e) => setProjetoId(e.target.value)} aria-invalid={!!erro}>
          {snap.projetos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id} — {p.nome || p.cliente}
            </option>
          ))}
        </select>
        {erro && <div className="field-error">{erro}</div>}
      </div>
      <div className="form-grid">
        <div>
          <label>Nº parcela</label>
          <input type="number" min="1" value={numero} onChange={(e) => setNumero(Number(e.target.value))} />
        </div>
        <div>
          <label>Vencimento</label>
          <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
        </div>
      </div>
      <div className="form-full">
        <label>Valor (R$)</label>
        <input type="number" step="0.01" value={valorReais} onChange={(e) => setValorReais(e.target.value)} />
      </div>
    </Modal>
  );
}
