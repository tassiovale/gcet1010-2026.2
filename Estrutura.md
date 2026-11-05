# Questify

Aplicação de login e cadastro com frontend React (Vite), API REST em Node.js e banco PostgreSQL do Supabase, tanto localmente quanto na Vercel.

## Estrutura

- `frontend/`: aplicação React, estilos e configuração do build Vite.
- `backend/server.js`: API de autenticação e servidor dos arquivos do frontend.
- `api/auth/login.js` e `api/auth/register.js`: funções serverless da Vercel.
- `api/health.js`: endpoint simples para confirmar que funções foram publicadas.
- `api/_lib/`: código compartilhado pelas funções e pelo servidor local.
- `supabase/migrations/`: schema versionado das tabelas da aplicação.

## Executar

Requer Node.js 22.13 ou superior e a connection string do pooler de transações do Supabase em `SUPABASE_DB_URL`. Instale as dependências com `npm install` e gere o frontend React:

```bash
export SUPABASE_DB_URL='postgres://postgres.PROJECT_REF:SENHA@aws-0-REGIAO.pooler.supabase.com:6543/postgres'
npm run build
npm start
```

Para desenvolvimento do frontend com recarregamento automático, execute `npm start` e `npm run dev` em terminais separados. O Vite encaminha as chamadas `/api` para o servidor local. Para servir a aplicação compilada, execute `npm run build` antes de `npm start`.

Obtenha a URL no painel Supabase em **Connect → Transaction pooler**. Abra `http://127.0.0.1:8000`. O servidor cria as tabelas `users` e `sessions` automaticamente se ainda não existirem. A tabela `users` armazena o hash PBKDF2-SHA256 da senha, nunca a senha original.

## Publicar na Vercel

1. Importe este repositório como um projeto na Vercel. O build Vite publica `frontend/dist` como site e mantém `api/` como funções Node.js.
2. No projeto Supabase, obtenha a connection string em **Connect → Transaction pooler**. Configure-a como `SUPABASE_DB_URL` nas variáveis do projeto Vercel, para Preview, Production e Development conforme necessário. Mantenha a variável privada e não use prefixo `NEXT_PUBLIC_`.
3. Faça o deploy. As tabelas `users` e `sessions` são criadas automaticamente na primeira chamada da API. O schema também está versionado em `supabase/migrations/20261029000000_create_auth_tables.sql` para aplicação pelo Supabase CLI ou SQL Editor.

Em **Settings → Build and Deployment**, deixe **Root Directory** apontando para a raiz deste repositório (não `frontend/`). A Vercel precisa encontrar `api/` na raiz para publicar as funções. O preset `Other` está definido em `vercel.json`.

O arquivo SQLite antigo foi removido do repositório e suas contas não foram migradas. O login do Questify usa tabelas próprias no PostgreSQL do Supabase e não depende do Supabase Auth.

O login cria tokens e registra sua sessão, mas o frontend atual não envia esses tokens em chamadas autenticadas nem há uma rota de logout.

## Rotas

- `POST /api/auth/register` com `{ "name", "email", "password" }`
- `POST /api/auth/login` com `{ "email", "password" }`

As respostas de erro usam status HTTP apropriados, como `401` para credenciais inválidas e `409` para e-mail já cadastrado. As rotas serverless da Vercel são `api/auth/login.js` e `api/auth/register.js`.

Após o deploy, `https://SEU-DOMINIO/api/health` verifica também a conexão com o Supabase. A resposta esperada é `{"status":"ok","service":"questify-api","database":"connected"}`. Se retornar `MISSING_SUPABASE_DB_URL`, configure essa variável na Vercel; outros códigos indicam falha de conexão ou configuração do banco.
