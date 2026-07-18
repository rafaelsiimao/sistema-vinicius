import { useMemo, useState } from "react";
import { useData } from "@/store/useData";
import { Modal } from "@/ui/Modal";
import { Kpi } from "@/ui/primitives";
import {
  linhasPagaveis,
  resumoPorCompetencia,
  saldoConsultor,
  type LinhaPagavel,
} from "@/lib/calc";
import { fmtBRL, fmtBRL2 } from "@/lib/money";
import { fmtDate, labelCompetencia, todayISO } from "@/lib/dates";
import { uuid } from "@/lib/id";
import type { Consultor, Pagamento } from "@/types";

const fmtH = (h: number) => h.toFixed(1);

export function Pagamentos() {
  const { isAdmin } = useData();
  return isAdmin ? <PagamentosAdmin /> : <MeusPagamentos />;
}

// ══════════════════════════════════════════════════════════════
// ADMIN — pago × a pagar por consultor e mês + registro
// ══════════════════════════════════════════════════════════════
function PagamentosAdmin() {
  const { snap, rateOf, toast, save, remove } = useData();
  const [pagar, setPagar] = useState<Consultor | null>(null);

  const nomeProjeto = useMemo(() => {
    const m = new Map(snap.projetos.map((p) => [p.id, p.nome || p.cliente]));
    return (id: string) => m.get(id) ?? id;
  }, [snap.projetos]);

  const porConsultor = snap.equipe
    .map((c) => ({
      c,
      saldo: saldoConsultor(c.id, snap.lancamentos, snap.pagamentos, rateOf),
      meses: resumoPorCompetencia(c.id, snap.lancamentos, snap.pagamentos, rateOf),
    }))
    .filter((x) => x.meses.length > 0);

  const totalAPagarCents = porConsultor.reduce((s, x) => s + Math.max(0, x.saldo.vSaldoCents), 0);
  const totalPagoCents = porConsultor.reduce((s, x) => s + x.saldo.vPagasCents, 0);

  const historico = [...snap.pagamentos].sort((a, b) => b.data.localeCompare(a.data));
  const nomeConsultor = (id: string) => snap.equipe.find((c) => c.id === id)?.nome ?? id;

  return (
    <>
      <div className="page-title">Pagamento de Horas</div>
      <div className="page-sub">Pago e a pagar por consultor e por mês</div>

      <div className="kpi-row">
        <Kpi label="Total a pagar" value={fmtBRL(totalAPagarCents)} tone="amber" />
        <Kpi label="Total já pago" value={fmtBRL(totalPagoCents)} tone="green" />
        <Kpi label="Consultores com saldo" value={porConsultor.filter((x) => x.saldo.hSaldo > 0.001).length} tone="accent" />
      </div>

      {porConsultor.map(({ c, saldo, meses }) => (
        <div className="tbl-wrap" key={c.id}>
          <div className="tbl-title">
            {c.nome}
            <span style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 400, fontSize: 12 }}>
              <span className="muted">custo/h {fmtBRL2(c.custoHoraCents)}</span>
              <span style={{ color: saldo.hSaldo > 0.001 ? "var(--amber)" : "var(--green)" }}>
                saldo {fmtH(saldo.hSaldo)}h · {fmtBRL(saldo.vSaldoCents)}
              </span>
              {saldo.hSaldo > 0.001 && (
                <button className="btn btn-sm btn-green" onClick={() => setPagar(c)}>
                  registrar pagamento
                </button>
              )}
            </span>
          </div>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th className="l">Mês (competência)</th>
                  <th>Horas trab.</th>
                  <th>Horas pagas</th>
                  <th>A pagar (h)</th>
                  <th>Valor pago</th>
                  <th>Valor a pagar</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {meses.map((m) => {
                  const situ =
                    m.horasSaldo <= 0.001
                      ? <span className="badge b-green">Pago</span>
                      : m.horasPagas > 0.001
                        ? <span className="badge b-orange">Parcial</span>
                        : <span className="badge b-amber">A pagar</span>;
                  return (
                    <tr key={m.competencia}>
                      <td className="l td-name">{labelCompetencia(m.competencia)}</td>
                      <td className="td-val">{fmtH(m.horasTrab)}</td>
                      <td className="td-val" style={{ color: "var(--green)" }}>{fmtH(m.horasPagas)}</td>
                      <td className="td-val" style={{ color: m.horasSaldo > 0.001 ? "var(--amber)" : "var(--tx3)", fontWeight: 700 }}>
                        {fmtH(m.horasSaldo)}
                      </td>
                      <td className="td-val" style={{ color: "var(--green)" }}>{fmtBRL(m.valorPagoCents)}</td>
                      <td className="td-val" style={{ color: m.horasSaldo > 0.001 ? "var(--amber)" : "var(--tx3)" }}>{fmtBRL(m.valorSaldoCents)}</td>
                      <td>{situ}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="tbl-wrap">
        <div className="tbl-title">Histórico de pagamentos</div>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Data pgto</th>
                <th className="l">Consultor</th>
                <th className="l">Projeto</th>
                <th>Ref. mês</th>
                <th>Horas</th>
                <th>Valor</th>
                <th className="l">Obs.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {historico.map((pg) => (
                <tr key={pg.id}>
                  <td>{fmtDate(pg.data)}</td>
                  <td className="l td-name">{nomeConsultor(pg.consultorId)}</td>
                  <td className="l" style={{ fontSize: 11 }}>{pg.projetoId ? nomeProjeto(pg.projetoId) : "Geral"}</td>
                  <td>{pg.competencia ? labelCompetencia(pg.competencia) : "—"}</td>
                  <td className="td-val" style={{ color: "var(--green)" }}>{fmtH(pg.horas)}</td>
                  <td className="td-val">{fmtBRL(pg.valorCents)}</td>
                  <td className="l muted" style={{ fontSize: 11 }}>{pg.obs}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => { void remove("pagamentos", pg.id); toast("Pagamento removido"); }}>
                      excluir
                    </button>
                  </td>
                </tr>
              ))}
              {historico.length === 0 && (
                <tr><td colSpan={8} className="empty-state">Nenhum pagamento registrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagar && (
        <PagarModal
          consultor={pagar}
          onClose={() => setPagar(null)}
          onConfirm={(pagamentos) => {
            for (const pg of pagamentos) void save("pagamentos", pg);
            toast(`${pagamentos.length} pagamento(s) registrado(s)`);
            setPagar(null);
          }}
        />
      )}
    </>
  );
}

function PagarModal({
  consultor,
  onClose,
  onConfirm,
}: {
  consultor: Consultor;
  onClose: () => void;
  onConfirm: (pagamentos: Pagamento[]) => void;
}) {
  const { snap, rateOf } = useData();
  const nomeProjeto = (id: string) => snap.projetos.find((p) => p.id === id)?.nome ?? id;
  const linhas = useMemo(
    () => linhasPagaveis(consultor.id, snap.lancamentos, snap.pagamentos),
    [snap, consultor.id],
  );
  // horas a pagar por linha (default = saldo completo)
  const [valores, setValores] = useState<Record<string, number>>(() =>
    Object.fromEntries(linhas.map((l) => [keyOf(l), l.horasSaldo])),
  );
  const [data, setData] = useState(todayISO());
  const ch = rateOf(consultor.id);

  const totalHoras = Object.values(valores).reduce((s, v) => s + (v || 0), 0);

  function confirmar() {
    const pagamentos: Pagamento[] = linhas
      .map((l) => ({ l, horas: valores[keyOf(l)] || 0 }))
      .filter((x) => x.horas > 0.001)
      .map(({ l, horas }) => ({
        id: uuid(),
        consultorId: consultor.id,
        projetoId: l.projetoId,
        horas: Math.min(horas, l.horasSaldo),
        valorCents: Math.round(Math.min(horas, l.horasSaldo) * ch),
        data,
        competencia: l.competencia,
        obs: `Ref. ${labelCompetencia(l.competencia)}`,
      }));
    if (pagamentos.length) onConfirm(pagamentos);
  }

  return (
    <Modal
      title={`Registrar pagamento — ${consultor.nome}`}
      subtitle="Ajuste as horas por mês/projeto. Marca cada pagamento na competência trabalhada."
      onClose={onClose}
      large
      actions={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-green" onClick={confirmar} disabled={totalHoras <= 0}>
            Confirmar {fmtBRL(Math.round(totalHoras * ch))}
          </button>
        </>
      }
    >
      <div className="form-full" style={{ maxWidth: 220 }}>
        <label>Data do pagamento</label>
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </div>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th className="l">Mês</th>
              <th className="l">Projeto</th>
              <th>Saldo (h)</th>
              <th>Horas a pagar</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const k = keyOf(l);
              return (
                <tr key={k}>
                  <td className="l td-name">{labelCompetencia(l.competencia)}</td>
                  <td className="l" style={{ fontSize: 11 }}>{nomeProjeto(l.projetoId)}</td>
                  <td className="td-val">{fmtH(l.horasSaldo)}</td>
                  <td style={{ textAlign: "right" }}>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max={l.horasSaldo}
                      value={valores[k]}
                      onChange={(e) => setValores((v) => ({ ...v, [k]: Math.min(Number(e.target.value), l.horasSaldo) }))}
                      style={{ width: 90, textAlign: "right" }}
                    />
                  </td>
                </tr>
              );
            })}
            {linhas.length === 0 && (
              <tr><td colSpan={4} className="empty-state">Sem saldo a pagar.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="calc-box">
        <div className="calc-line calc-final">
          <span>Total a pagar ({fmtH(totalHoras)}h)</span>
          <b>{fmtBRL(Math.round(totalHoras * ch))}</b>
        </div>
      </div>
    </Modal>
  );
}

function keyOf(l: LinhaPagavel): string {
  return `${l.competencia}||${l.projetoId}`;
}

// ══════════════════════════════════════════════════════════════
// CONSULTOR — só o próprio a receber, por mês (somente leitura)
// ══════════════════════════════════════════════════════════════
function MeusPagamentos() {
  const { snap, currentUser, rateOf } = useData();
  if (!currentUser) return null;

  const meses = resumoPorCompetencia(currentUser.id, snap.lancamentos, snap.pagamentos, rateOf);
  const saldo = saldoConsultor(currentUser.id, snap.lancamentos, snap.pagamentos, rateOf);
  const nomeProjeto = (id: string) => snap.projetos.find((p) => p.id === id)?.nome ?? id;
  const meusPagamentos = snap.pagamentos
    .filter((p) => p.consultorId === currentUser.id)
    .sort((a, b) => b.data.localeCompare(a.data));

  return (
    <>
      <div className="page-title">Meus Pagamentos</div>
      <div className="page-sub">Suas horas pagas e a receber, por mês</div>

      <div className="kpi-row">
        <Kpi label="A receber" value={fmtBRL(saldo.vSaldoCents)} tone="amber" sub={`${fmtH(saldo.hSaldo)}h`} />
        <Kpi label="Já recebido" value={fmtBRL(saldo.vPagasCents)} tone="green" sub={`${fmtH(saldo.hPagas)}h`} />
        <Kpi label="Total trabalhado" value={`${fmtH(saldo.hTrab)}h`} tone="accent" />
      </div>

      <div className="tbl-wrap">
        <div className="tbl-title">Por mês</div>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th className="l">Mês</th>
                <th>Horas trab.</th>
                <th>Horas pagas</th>
                <th>A receber (h)</th>
                <th>Valor a receber</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.competencia}>
                  <td className="l td-name">{labelCompetencia(m.competencia)}</td>
                  <td className="td-val">{fmtH(m.horasTrab)}</td>
                  <td className="td-val" style={{ color: "var(--green)" }}>{fmtH(m.horasPagas)}</td>
                  <td className="td-val" style={{ color: m.horasSaldo > 0.001 ? "var(--amber)" : "var(--tx3)", fontWeight: 700 }}>{fmtH(m.horasSaldo)}</td>
                  <td className="td-val" style={{ color: m.horasSaldo > 0.001 ? "var(--amber)" : "var(--tx3)" }}>{fmtBRL(m.valorSaldoCents)}</td>
                  <td>{m.horasSaldo <= 0.001 ? <span className="badge b-green">Recebido</span> : <span className="badge b-amber">A receber</span>}</td>
                </tr>
              ))}
              {meses.length === 0 && (
                <tr><td colSpan={6} className="empty-state">Você ainda não tem horas lançadas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tbl-wrap">
        <div className="tbl-title">Meus recebimentos</div>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th className="l">Projeto</th>
                <th>Ref. mês</th>
                <th>Horas</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {meusPagamentos.map((pg) => (
                <tr key={pg.id}>
                  <td>{fmtDate(pg.data)}</td>
                  <td className="l" style={{ fontSize: 11 }}>{pg.projetoId ? nomeProjeto(pg.projetoId) : "Geral"}</td>
                  <td>{pg.competencia ? labelCompetencia(pg.competencia) : "—"}</td>
                  <td className="td-val" style={{ color: "var(--green)" }}>{fmtH(pg.horas)}</td>
                  <td className="td-val">{fmtBRL(pg.valorCents)}</td>
                </tr>
              ))}
              {meusPagamentos.length === 0 && (
                <tr><td colSpan={5} className="empty-state">Nenhum recebimento ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
