-- =====================================================================
-- RLS (Row Level Security) - Projeto Anjos Inocentes
-- =====================================================================
-- CONTEXTO IMPORTANTE:
-- O app NÃO usa a Data API pública do Supabase (PostgREST + anon key).
-- Todo acesso a dados acontece no servidor (rotas /api do Next.js) através
-- de uma CONEXÃO DIRETA ao Postgres (driver `pg`, ver apps/web/lib/pg-collection.ts),
-- usando o role `postgres` da DATABASE_URL. Esse role é DONO das tabelas e,
-- por padrão, IGNORA o RLS.
--
-- Consequências:
--   * Habilitar RLS abaixo NÃO quebra o app (a conexão direta continua passando).
--   * NÃO usar `FORCE ROW LEVEL SECURITY` - isso faria o dono também obedecer ao
--     RLS e derrubaria o app. Usamos apenas `ENABLE`.
--   * Sem políticas permissivas, a API pública (anon/authenticated) fica
--     efetivamente BLOQUEADA (deny-all), que é exatamente o que queremos, já que
--     a anon key é pública e as tabelas contêm dados sensíveis (ex.: hash de senha).
--
-- Rode este arquivo UMA vez no SQL Editor do Supabase, DEPOIS do supabase-schema.sql.
-- =====================================================================

-- 1) Habilita RLS em todas as tabelas do app (deny-all por padrão para a Data API).
alter table public.users                    enable row level security;
alter table public.students                 enable row level security;
alter table public.classes                  enable row level security;
alter table public.attendances              enable row level security;
alter table public.lessons                  enable row level security;
alter table public.courses                  enable row level security;
alter table public.events                   enable row level security;
alter table public.audit_logs               enable row level security;
alter table public.announcements            enable row level security;
alter table public.student_attachments      enable row level security;
alter table public.pdis                     enable row level security;
alter table public.pdi_tracking             enable row level security;
alter table public.pdi_evolutions           enable row level security;
alter table public.password_resets          enable row level security;
alter table public.password_reset_attempts  enable row level security;
alter table public.login_attempts           enable row level security;

-- 2) Cinto e suspensório: revoga qualquer privilégio dos roles públicos da Data API.
--    Mesmo com RLS, isto garante que anon/authenticated não tenham grants nas tabelas.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- Impede que grants sejam concedidos automaticamente a objetos futuros.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- =====================================================================
-- NOTA: Como este app NÃO cria políticas permissivas, a Data API fica
-- travada. Recomendado também DESLIGAR a Data API em:
--   Supabase > Project Settings > Data API  (Expose "public" schema = OFF)
-- e usar SEMPRE a connection string direta na DATABASE_URL do app.
-- =====================================================================
