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
  dataSource: "local",

  // Valores do projeto Supabase:  Supabase → Project Settings → API
  supabaseUrl: "COLE_AQUI_A_PROJECT_URL",         // ex.: https://xxxx.supabase.co
  supabaseAnonKey: "COLE_AQUI_A_ANON_PUBLIC_KEY"  // a chave "anon public" (pode ser pública)
};
