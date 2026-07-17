const json = (res, status, body) => {
  res.status(status).json(body);
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

  res.setHeader("cache-control", "no-cache, no-store, must-revalidate");
  json(res, 200, {
    dataSource: supabaseUrl && supabaseAnonKey ? "supabase" : "local",
    supabaseUrl,
    supabaseAnonKey,
  });
}
