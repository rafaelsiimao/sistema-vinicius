const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-cache, no-store, must-revalidate");
  res.end(JSON.stringify(body));
};

export default function handler(_req, res) {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "";

  json(res, 200, {
    dataSource: supabaseUrl && supabaseAnonKey ? "supabase" : "local",
    supabaseUrl,
    supabaseAnonKey,
  });
}
