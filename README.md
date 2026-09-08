# Projeto Anjos

Sistema de gestão escolar desenvolvido para facilitar a administração de instituições de ensino. É uma aplicação **Next.js fullstack**: o mesmo app serve o frontend (interface moderna com Radix UI e Tailwind CSS) e as rotas de API (`app/api/**`), que persistem os dados em **PostgreSQL (Supabase)**.

## Funcionalidades

### Autenticação, Cargos e Permissões
- Login e autenticação segura via JWT
- Cargos estruturados com permissões predefinidas:
  - **ADMIN** (Administrador): Super-usuário com controle total, livre de restrições de permissão.
  - **DIRECTOR** (Diretor): Acesso completo de gestão.
  - **COORDINATOR** (Coordenador): Gerenciamento pedagógico de alunos, turmas e notas.
  - **SECRETARY** (Secretário): Gestão de alunos, turmas e comunicados.
  - **TEACHER** (Professor): Lançamento de notas, presenças, planos de aula e calendário.
- As permissões associadas a cada cargo são:
  - `alunos`: Cadastrar e gerenciar alunos.
  - `turmas`: Criar e gerenciar turmas.
  - `presenca`: Registrar chamadas e presenças.
  - `plano_aula`: Planejar aulas por turma.
  - `calendario`: Visualizar e gerenciar eventos no calendário.
  - `comunicacao`: Gerenciar avisos e comunicados.
  - `notas`: Lançar e gerenciar notas.

### Gestão de Equipe (Colaboradores)
- Cadastro completo de colaboradores (professores, coordenadores, secretários e diretores) contendo:
  - Nome, E-mail e Cargo
  - CPF, Telefone, Data de Nascimento e Endereço
- Histórico completo de colaboradores ativos e inativos
- Exportação da lista de colaboradores para CSV com todos os dados pessoais inclusos

### Gestão de Alunos
- Cadastro completo de alunos (Nome, CPF, Data de Nascimento, Email, Telefone, Endereço e Curso)
- Matrícula em múltiplas turmas
- Importação em massa de alunos via planilha CSV

### Gestão de Turmas
- Criação e administração de turmas ligadas a cursos, horários, salas, capacidade e professor responsável
- Indicação de turmas sem professor associado para rápida alocação

### Auditoria e Segurança
- Histórico de auditoria completo para administradores e diretores
- Registro cronológico de ações sensíveis (criar, atualizar, excluir registros ou redefinir senhas)

---

## Tecnologias Utilizadas

### Aplicação (Next.js fullstack)
- **Next.js 16** com App Router e **TypeScript**
- **Rotas de API** em `app/api/**` (backend server-side no próprio Next.js)
- **PostgreSQL (Supabase)** para persistência, acessado via driver `pg` — ver `lib/pg-collection.ts`
- **JWT** para autenticação e **bcryptjs** para hashing de senhas
- **Zod** para validação de esquemas
- **Nodemailer** para e-mails de recuperação de senha
- **Tailwind CSS** e **Radix UI** para a interface
- **Recharts** para relatórios e estatísticas
- **React Hook Form** para formulários

---

## Estrutura do Projeto

```
projeto-anjos/
├── apps/
│   └── web/                    # Aplicação Next.js (frontend + API)
│       ├── app/
│       │   ├── api/            # Rotas de API (auth, alunos, turmas, presença, PDI, etc.)
│       │   └── dashboard/      # Páginas do painel (crianças, equipe, calendário, relatórios…)
│       ├── components/
│       │   ├── ui/             # Componentes de UI genéricos (botões, diálogos, tabela…)
│       │   ├── reports/        # Relatórios (ficha, presença, frequência, institucional)
│       │   └── {auth,comunicacao,criancas,pdi}/  # Componentes por domínio
│       ├── lib/                # Código client/compartilhado
│       │   ├── server/         # Código EXCLUSIVO de servidor (nunca vai ao bundle do cliente):
│       │   │                   #   acesso ao Postgres (pg-collection, server-db),
│       │   │                   #   auth (server-auth), e-mail (mailer), reset de senha, PDI
│       │   ├── api.ts          # Cliente HTTP das rotas /api
│       │   ├── schemas.ts      # Schemas de validação (Zod)
│       │   ├── validators.ts   # Validações puras (CPF, e-mail) usadas pelos schemas
│       │   ├── permissions.ts  # Cargos e permissões
│       │   └── types.ts        # Tipos compartilhados
│       ├── hooks/              # Hooks React reutilizáveis
│       └── styles/             # Estilos globais
├── db/                         # Scripts SQL do banco (Supabase)
│   ├── supabase-schema.sql     # Schema do banco (rodar 1x no Supabase)
│   └── supabase-rls.sql        # Políticas de RLS/segurança (rodar após o schema)
├── iniciar.bat                 # Atalho para instalar dependências e subir o app (Windows)
├── package.json                # Configuração do monorepo
└── README.md
```

> **Convenção do `lib/`:** o que estiver em `lib/server/` só pode ser importado por rotas de API
> (`app/api/**`) ou por outro código de servidor — nunca por componentes com `"use client"`.
> Isso mantém segredos e o acesso ao banco fora do pacote enviado ao navegador.

---

## Instalação e Configuração

### Pré-requisitos
- Node.js 18+
- Um banco **PostgreSQL** (recomendado: projeto no [Supabase](https://supabase.com))

### Instalação

1. **Instale as dependências**
   ```bash
   npm install
   ```

2. **Crie o banco e aplique o schema**
   - Crie um projeto no Supabase.
   - No **SQL Editor**, cole e rode `db/supabase-schema.sql` (cria as tabelas e o administrador padrão).
   - Em seguida, rode `db/supabase-rls.sql` para habilitar a segurança em nível de linha (RLS).

3. **Configuração de Variáveis de Ambiente**
   - No diretório `apps/web`, crie/edite o arquivo `.env`:
     ```env
     # Connection string (URI) do Postgres: Supabase > Project Settings > Database > Connection string
     DATABASE_URL="postgresql://postgres:SENHA@db.SEU-PROJETO.supabase.co:5432/postgres"
     # Segredo aleatório forte (mín. 16 caracteres). Ex.: node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
     JWT_SECRET="defina-um-segredo-aleatorio-forte"

     # Opcional - e-mail de recuperação de senha (Gmail com Senha de App):
     MAIL_HOST=smtp.gmail.com
     MAIL_PORT=587
     MAIL_USER=
     MAIL_PASSWORD=
     MAIL_FROM="Projeto Anjos Inocentes <seuemail@gmail.com>"
     FRONTEND_URL=http://localhost:3000
     ```

O administrador padrão é criado pelo schema: `admin@anjosinocentes.org.br` / senha `admin123`. **Troque a senha no primeiro login.**

---

## Executando o Projeto

### Modo de Desenvolvimento
```bash
npm run dev        # Web + API em http://localhost:3000
```

### Produção
```bash
npm run build
npm run start
```

---

## Licença
Este projeto está sob a licença MIT.
