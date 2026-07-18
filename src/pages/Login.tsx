import { useState } from "react";
import { useAuth } from "@/auth/useAuth";

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    const { error } = await signIn(email, senha);
    setCarregando(false);
    if (error) setErro(error);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form onSubmit={entrar} className="modal" style={{ maxWidth: 380 }}>
        <div className="brand" style={{ borderBottom: "none", textAlign: "center", fontSize: 28, marginBottom: 4 }}>
          JO<span>B</span>Z
        </div>
        <div className="modal-sub" style={{ textAlign: "center", marginBottom: 20 }}>
          Sistema de Gestão — entre com sua conta
        </div>
        <div className="form-full">
          <label>E-mail</label>
          <input
            type="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@jobz.com.br"
            autoComplete="username"
          />
        </div>
        <div className="form-full">
          <label>Senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {erro && <div className="field-error" style={{ marginBottom: 10 }}>{erro}</div>}
        <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={carregando}>
          {carregando ? "Entrando…" : "Entrar"}
        </button>
        <div className="hint" style={{ textAlign: "center", marginTop: 14 }}>
          Sem acesso? Peça ao administrador para criar sua conta.
        </div>
      </form>
    </div>
  );
}
