# Sistema Vinicius / JOBZ

Entrega estática do sistema interno JOBZ para publicação na Vercel com banco e login pelo Supabase.

## Estrutura

- `dist/`: app React já compilado.
- `dist/config.js`: gerado no build a partir das variáveis de ambiente.
- `supabase/schema.sql`: schema inicial do banco, índices e políticas RLS.
- `scripts/import-to-supabase.mjs`: importação opcional do backup inicial usando `service_role`.
- `scripts/generate-config.mjs`: gera a configuração pública do frontend para Vercel.
- `dist/admin-users.html`: ferramenta admin para criar login no Supabase Auth e membro em Equipe.
- `api/create-consultor.mjs`: função segura usada por `admin-users.html`.

## Vercel

Configure o projeto na Vercel apontando para este repositório.

Variáveis de ambiente:

- `JOBZ_DATA_SOURCE=supabase`
- `SUPABASE_URL=https://xxxx.supabase.co`
- `SUPABASE_ANON_KEY=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`

`SUPABASE_SERVICE_ROLE_KEY` fica disponível apenas para a função serverless `api/create-consultor.mjs`. Ela não é escrita no `dist/config.js`.

Configuração já versionada:

- Build Command: `npm run build`
- Output Directory: `dist`
- SPA rewrite: qualquer rota cai em `/index.html`

## Supabase

1. Crie um projeto Supabase.
2. Rode `supabase/schema.sql` no SQL Editor.
3. Crie o primeiro usuário admin em Authentication.
4. Faça o primeiro login no app.
5. Importe o backup pelo app ou via script local.
6. Depois de validar os usuários, ative o bloco de RLS por papel no final do schema.

## Importação local

Instale as dependências:

```bash
npm install
```

Defina as variáveis somente na sua máquina:

```powershell
$env:SUPABASE_URL="https://xxxx.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="service_role_secret"
$env:JOBZ_ADMIN_EMAIL="admin@exemplo.com"
$env:JOBZ_ADMIN_PASSWORD="senha_temporaria_forte"
$env:JOBZ_ADMIN_NAME="Nome do Admin"
npm run import:supabase -- "caminho\jobz_backup_XXXX.json"
```

Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` no GitHub, em arquivos do projeto ou no frontend. Na Vercel, ela pode ser configurada como Environment Variable porque será lida somente no servidor pela função `/api/create-consultor`.

## Cadastro de usuários

Acesse:

```text
https://sua-url.vercel.app/admin-users.html
```

Entre com um usuário que já seja `admin` em `consultores`. Essa tela cria o usuário no Supabase Authentication e grava/atualiza o consultor na tabela `consultores`.
