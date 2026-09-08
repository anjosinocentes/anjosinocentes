-- Schema Postgres para Supabase (Projeto Anjos Inocentes)
--
-- Cada "coleção" do app (antes no MongoDB) vira aqui uma tabela com um único campo `doc`
-- (JSONB) guardando o documento inteiro, mais `id` como coluna/chave primária. O código em
-- apps/web/lib/pg-collection.ts fala com essas tabelas através de uma API parecida com a do
-- driver MongoDB (find/insertOne/updateOne/...), por isso não há colunas tipadas tradicionais
-- por campo - o "schema" de cada documento é o mesmo que já existia no Mongo.
--
-- Como usar: cole este arquivo inteiro no SQL Editor do seu projeto Supabase e rode uma vez.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id text primary key,
  doc jsonb not null,
  created_at timestamptz not null default now()
);
create unique index if not exists users_email_idx on public.users ((doc->>'email'));

create table if not exists public.students (
  id text primary key,
  doc jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists students_cpf_idx on public.students ((doc->>'cpf'));

create table if not exists public.classes (
  id text primary key,
  doc jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.attendances (
  id text primary key,
  doc jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists attendances_date_idx on public.attendances ((doc->>'date'));

create table if not exists public.lessons (
  id text primary key,
  doc jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id text primary key,
  doc jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id text primary key,
  doc jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key,
  doc jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id text primary key,
  doc jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.student_attachments (
  id text primary key,
  doc jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists student_attachments_student_idx on public.student_attachments ((doc->>'studentId'));

create table if not exists public.pdis (
  id text primary key,
  doc jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists pdis_student_idx on public.pdis ((doc->>'studentId'));

create table if not exists public.pdi_tracking (
  id text primary key,
  doc jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists pdi_tracking_student_idx on public.pdi_tracking ((doc->>'studentId'));

create table if not exists public.pdi_evolutions (
  id text primary key,
  doc jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists pdi_evolutions_student_idx on public.pdi_evolutions ((doc->>'studentId'));

create table if not exists public.password_resets (
  id text primary key,
  doc jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists password_resets_user_idx on public.password_resets ((doc->>'userId'));
create index if not exists password_resets_token_idx on public.password_resets ((doc->>'tokenHash'));

create table if not exists public.password_reset_attempts (
  id text primary key,
  doc jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists password_reset_attempts_email_idx on public.password_reset_attempts ((doc->>'email'));
create index if not exists password_reset_attempts_ip_idx on public.password_reset_attempts ((doc->>'ip'));

-- Tentativas de login que falharam - usadas para o rate limit anti brute-force (lib/server/login-rate-limit.ts).
create table if not exists public.login_attempts (
  id text primary key,
  doc jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_email_idx on public.login_attempts ((doc->>'email'));
create index if not exists login_attempts_ip_idx on public.login_attempts ((doc->>'ip'));

-- Índices GIN gerais, para buscas eventuais por qualquer campo do documento.
create index if not exists users_doc_gin on public.users using gin (doc);
create index if not exists students_doc_gin on public.students using gin (doc);
create index if not exists classes_doc_gin on public.classes using gin (doc);
create index if not exists attendances_doc_gin on public.attendances using gin (doc);
create index if not exists lessons_doc_gin on public.lessons using gin (doc);
create index if not exists courses_doc_gin on public.courses using gin (doc);
create index if not exists events_doc_gin on public.events using gin (doc);
create index if not exists audit_logs_doc_gin on public.audit_logs using gin (doc);
create index if not exists announcements_doc_gin on public.announcements using gin (doc);
create index if not exists student_attachments_doc_gin on public.student_attachments using gin (doc);
create index if not exists pdis_doc_gin on public.pdis using gin (doc);
create index if not exists pdi_tracking_doc_gin on public.pdi_tracking using gin (doc);
create index if not exists pdi_evolutions_doc_gin on public.pdi_evolutions using gin (doc);

-- Usuário administrador padrão (login: admin@anjosinocentes.org.br / senha: admin123).
-- Troque a senha assim que fizer o primeiro login.
-- IMPORTANTE: o hash abaixo é gerado pelo bcryptjs (mesma lib que o app usa em lib/server-db.ts).
-- NÃO use crypt()/gen_salt() do pgcrypto aqui: o hash do pgcrypto não é validado pelo bcryptjs
-- e o login falharia com "Credenciais inválidas". O hash abaixo corresponde à senha "admin123".
insert into public.users (id, doc)
values (
  'admin-default-id',
  jsonb_build_object(
    'id', 'admin-default-id',
    'email', 'admin@anjosinocentes.org.br',
    'password', '$2a$10$IxIFBVXROym1/HS4sxIrfegF14V96PHenM2wB7o1OFtqSDxfDXEii',
    'name', 'Administrador',
    'role', 'ADMIN',
    'active', true,
    'permissions', jsonb_build_array('alunos', 'turmas', 'presenca', 'plano_aula', 'calendario', 'comunicacao', 'pdis'),
    'createdAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )
)
on conflict (id) do nothing;
