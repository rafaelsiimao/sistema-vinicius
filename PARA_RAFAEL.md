# JOBZ — Instruções de publicação (para o Rafael)

Sistema interno de gestão (React SPA estático) para publicar em **https://app.jobz.com.br**,
com **login** e **banco na nuvem** (Supabase). Uso compartilhado / multiusuário.

## O que você recebe (na pasta `jobz-app`)

| Item | Para quê |
|---|---|
| **`dist/`** | O site pronto (estático). É isto que sobe para o servidor. |
| `dist/config.js` | Configuração editável **no servidor** (URL/chave do Supabase). Sem recompilar. |
| `dist/.htaccess` | Roteamento SPA no Apache (já incluso). |
| `supabase/schema.sql` | Cria o banco (tabelas, índices, segurança). |
| `scripts/import-to-supabase.mjs` | (Opcional) carga inicial de dados via linha de comando. |
| `jobz_backup_*.json` | O backup de dados (o Vinícius te envia; já com os e-mails da equipe). |

> Observação: a hospedagem é a de sempre (Cloudflare na frente do servidor). O **backend
> Supabase é novo** — plano grátis atende. Se preferir, o Vinícius pode criar a conta e te
> passar as chaves; ou você cria.

---

## Passo 1 — Backend (Supabase)

1. Crie um projeto grátis em **https://supabase.com** (região *South America (São Paulo)*).
2. **SQL Editor → New query** → cole todo o `supabase/schema.sql` → **Run**.
3. **Authentication → Users → Add user**: crie **o primeiro usuário admin** (o e-mail do
   Vinícius) com senha, e marque **Auto Confirm User**.
4. **Project Settings → API** → copie:
   - **Project URL** (ex.: `https://xxxx.supabase.co`)
   - **anon public** key (vai no site — pode ser pública, a segurança é a RLS)

---

## Passo 2 — Publicar o front no servidor

1. No **cPanel → Subdomínios**, crie **`app`** em `jobz.com.br`. Anote a pasta raiz criada.
2. Edite o **`dist/config.js`** e preencha 3 campos:
   ```js
   window.__JOBZ_CONFIG__ = {
     dataSource: "supabase",                 // troque de "local" para "supabase"
     supabaseUrl: "https://xxxx.supabase.co",// a Project URL do Passo 1
     supabaseAnonKey: "a_anon_public_key"    // a anon key do Passo 1
   };
   ```
3. Envie **todo o conteúdo de `dist/`** (incluindo os ocultos **`.htaccess`** e o
   **`config.js`** já editado) para a pasta raiz do subdomínio, via FTP ou Gerenciador de
   Arquivos. (Sobe o *conteúdo* de `dist/`, não a pasta em si.)

---

## Passo 3 — DNS (Cloudflare)

1. Cloudflare → domínio **jobz.com.br** → **DNS → Add record**.
2. Registro **A** (ou **CNAME**), nome **app**, apontando para o **mesmo servidor** do
   `consultoria` (mesmo IP/destino), **Proxy ativado (laranja)**.
3. O SSL do Cloudflare cobre o subdomínio automaticamente.

Pronto: **https://app.jobz.com.br** abre a tela de login.

---

## Passo 4 — Carga inicial dos dados

Duas opções (escolha uma):

**Opção A — pelo próprio app (mais simples):**
1. Acesse `app.jobz.com.br` e entre com o usuário admin do Passo 1.
2. Como o banco está vazio, o sistema entra em modo de carga e mostra um aviso.
3. Barra lateral → **Dados → Importar / migrar backup** → selecione o `jobz_backup_*.json`.
   Os dados (equipe, projetos, tarefas, financeiro) são carregados.

**Opção B — por linha de comando (na sua máquina, com Node):**
```bash
# na pasta jobz-app:
$env:SUPABASE_URL="https://xxxx.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="a_service_role_key"   # Settings → API (SECRETA)
node scripts/import-to-supabase.mjs "caminho\jobz_backup_XXXX.json"
```

---

## Passo 5 — Demais usuários e segurança final

1. Para cada pessoa da equipe: **Authentication → Add user** (mesmo e-mail que está no
   backup/na tela **Equipe** do app). O sistema reconhece o papel (admin/consultor) pelo e-mail.
2. **Ligue a RLS por papel** (recomendado, depois que os logins funcionarem): no **SQL
   Editor**, rode o bloco **PASSO 2** do `supabase/schema.sql` (está comentado entre `/* */`).
   A partir daí, um consultor **nem consegue consultar** dado de outro no banco.

---

## Atualizações futuras do app

Quando eu te enviar uma nova versão, é só substituir o conteúdo de `dist/` no servidor
(o `config.js` do servidor é preservado — não sobrescreva ele). Os usuários pegam a versão
nova no próximo carregamento.

## Segurança — o que NÃO vai para o servidor

| Chave | Vai no site? |
|---|---|
| **anon public** | Sim (no `config.js`) — protegida pela RLS |
| **service_role** | **NÃO** — use só na carga da Opção B, na sua máquina |
