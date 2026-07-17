import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

const requiredEnv = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

function envError() {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  return missing.length ? `Variaveis ausentes na Vercel: ${missing.join(", ")}` : "";
}

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function centsFromCurrency(value) {
  const normalized = String(value ?? "0").replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function findAuthUserByEmail(adminClient, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw error;

    const found = data.users.find(
      (user) => normalizeEmail(user.email) === email
    );
    if (found) return found;
    if (data.users.length < 100) return null;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Metodo nao permitido." });
  }

  const missingEnv = envError();
  if (missingEnv) return json(res, 500, { error: missingEnv });

  const authHeader = String(req.headers.authorization ?? "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json(res, 401, { error: "Login obrigatorio." });

  const anonClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
  const adminClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const { data: userData, error: userError } = await anonClient.auth.getUser(token);
  if (userError || !userData.user?.email) {
    return json(res, 401, { error: "Sessao invalida ou expirada." });
  }

  const callerEmail = normalizeEmail(userData.user.email);
  const { data: callerRows, error: callerError } = await adminClient
    .from("consultores")
    .select("id,email,papel,ativo")
    .ilike("email", callerEmail)
    .limit(1);

  if (callerError) return json(res, 500, { error: callerError.message });

  const caller = callerRows?.[0];
  if (!caller?.ativo || caller.papel !== "admin") {
    return json(res, 403, { error: "Somente admin pode criar usuarios." });
  }

  let payload;
  try {
    payload = await readBody(req);
  } catch {
    return json(res, 400, { error: "JSON invalido." });
  }

  const email = normalizeEmail(payload.email);
  const password = String(payload.password ?? "");
  const nome = String(payload.nome ?? "").trim();
  const funcao = String(payload.funcao ?? "Consultor").trim() || "Consultor";
  const papel = payload.papel === "admin" ? "admin" : "consultor";
  const ativo = payload.ativo !== false;
  const custoHoraCents = centsFromCurrency(payload.custoHora);

  if (!nome) return json(res, 400, { error: "Nome e obrigatorio." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(res, 400, { error: "E-mail invalido." });
  }
  if (password.length < 8) {
    return json(res, 400, { error: "A senha precisa ter pelo menos 8 caracteres." });
  }

  try {
    const existingAuthUser = await findAuthUserByEmail(adminClient, email);
    if (existingAuthUser) {
      const { error } = await adminClient.auth.admin.updateUserById(
        existingAuthUser.id,
        {
          password,
          email_confirm: true,
          user_metadata: { nome, papel },
        }
      );
      if (error) throw error;
    } else {
      const { error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome, papel },
      });
      if (error) throw error;
    }

    const { data: existingRows, error: existingError } = await adminClient
      .from("consultores")
      .select("id")
      .ilike("email", email)
      .limit(1);
    if (existingError) throw existingError;

    const consultor = {
      id: existingRows?.[0]?.id ?? randomUUID(),
      nome,
      email,
      funcao,
      custo_hora_cents: custoHoraCents,
      ativo,
      papel,
    };

    const { error: upsertError } = await adminClient
      .from("consultores")
      .upsert(consultor);
    if (upsertError) throw upsertError;

    return json(res, 200, {
      ok: true,
      consultor: {
        id: consultor.id,
        nome,
        email,
        funcao,
        papel,
        ativo,
      },
    });
  } catch (error) {
    return json(res, 500, {
      error: error.message || "Nao foi possivel criar o usuario.",
    });
  }
}
