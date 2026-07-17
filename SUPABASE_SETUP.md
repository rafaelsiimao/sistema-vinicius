# Configuracao Supabase

Este checklist configura o backend do JOBZ para uso multiusuario.

## 1. Criar projeto

1. Acesse Supabase e crie um projeto.
2. Regiao recomendada: South America, se disponivel.
3. Anote:
   - Project URL
   - anon/public key
   - service_role key, somente para importacao local se necessario

## 2. Criar banco inicial

No Supabase Studio:

1. Abra SQL Editor.
2. Crie uma query nova.
3. Cole todo o conteudo de `supabase/schema.sql`.
4. Clique em Run.

Este passo cria as tabelas e ativa uma RLS inicial chamada `auth_all`, onde qualquer usuario autenticado acessa tudo. Isso facilita a primeira carga de dados.

## 3. Criar primeiro admin

Em Authentication > Users:

1. Clique em Add user.
2. Use o e-mail do primeiro administrador.
3. Defina uma senha temporaria forte.
4. Marque Auto Confirm User, se a opcao aparecer.

Importante: esse mesmo e-mail precisa existir em `consultores.email` depois da importacao/cadastro da equipe, com `papel = 'admin'`.

Alternativa: se voce for importar por linha de comando, o script `scripts/import-to-supabase.mjs` tambem pode criar o usuario de Auth e promover o consultor para admin automaticamente. Para isso, use as variaveis `JOBZ_ADMIN_EMAIL`, `JOBZ_ADMIN_PASSWORD` e, opcionalmente, `JOBZ_ADMIN_NAME`.

## 4. Configurar Vercel

No projeto da Vercel, configure:

```text
JOBZ_DATA_SOURCE=supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` sera usada somente pela funcao serverless `/api/create-consultor`. Ela nao vai para `dist/config.js`.

Depois faca um novo deploy. O build gera `dist/config.js` automaticamente.

## 5. Importar dados

Opcao recomendada:

1. Acesse o app publicado.
2. Entre com o usuario admin.
3. Va em Dados > Importar / migrar backup.
4. Envie o arquivo `jobz_backup_*.json`.

Opcao local:

```powershell
$env:SUPABASE_URL="https://xxxx.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="service_role_secret"
$env:JOBZ_ADMIN_EMAIL="admin@exemplo.com"
$env:JOBZ_ADMIN_PASSWORD="senha_temporaria_forte"
$env:JOBZ_ADMIN_NAME="Nome do Admin"
npm install
npm run import:supabase -- "caminho\jobz_backup_XXXX.json"
```

Quando `JOBZ_ADMIN_EMAIL` estiver definido, o importador:

- cria/confirma o usuario em Authentication se `JOBZ_ADMIN_PASSWORD` tambem estiver definido;
- se encontrar esse e-mail na equipe importada, define `papel = 'admin'`;
- se nao encontrar, cria um consultor admin minimo para esse e-mail.

## 6. Validar antes da RLS final

No SQL Editor, rode `supabase/healthcheck.sql`.

Confirme:

- tabelas existem;
- `rowsecurity` esta ligado;
- usuarios conseguem logar;
- admin aparece em `consultores` com e-mail igual ao login;
- ao menos um usuario tem `papel = 'admin'`.

## 7. Ativar RLS por papel

Depois da validacao:

1. SQL Editor.
2. Cole `supabase/rls-by-role.sql`.
3. Run.
4. Teste login como admin.
5. Teste login como consultor.

Se algum consultor nao enxergar dados esperados, confira se o e-mail em Authentication e `consultores.email` esta identico.

## Cadastro integrado de usuarios

Depois do deploy, acesse:

```text
https://sua-url.vercel.app/admin-users.html
```

Entre com um usuario admin. A tela cria ao mesmo tempo:

- o usuario no Supabase Authentication;
- o membro em `consultores`.
