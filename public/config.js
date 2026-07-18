/* ═══════════════════════════════════════════════════════════════
   CONFIGURAÇÃO DO JOBZ  —  EDITE ESTE ARQUIVO NO SERVIDOR
   (não precisa recompilar o app; basta editar e salvar)

   >>> PARA O USO COMPARTILHADO (produção), faça 3 coisas: <<<
     1) troque dataSource para "supabase"
     2) preencha supabaseUrl
     3) preencha supabaseAnonKey
   ═══════════════════════════════════════════════════════════════ */
window.__JOBZ_CONFIG__ = {
  // "supabase" = nuvem / uso compartilhado (com login).
  // "local"    = teste no próprio navegador (sem login). [padrão de fábrica]
  dataSource: "supabase",

  // Valores do projeto Supabase:  Supabase → Project Settings → API
  supabaseUrl: "https://foujodkyckjryjickhbq.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvdWpvZGt5Y2tqcnlqaWNraGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzNTMyNjYsImV4cCI6MjA2MDkyOTI2Nn0._plVJRRuQQUVg2nOmH7VEXFcFiRCfqtzjKqZDeJgqqw"
};
