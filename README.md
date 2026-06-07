# Events API

API REST para gerenciamento de eventos, atividades e matrículas, construída com **Fastify 5** e **TypeBox**.

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Fastify 5 |
| Schemas / Validação | @sinclair/typebox 0.34 |
| Documentação | @fastify/swagger + @fastify/swagger-ui |
| Linguagem | TypeScript 5 |
| Testes | Vitest 2 |
| Linting | ESLint + typescript-eslint |
| Runtime dev | tsx |
| Banco de dados | PostgreSQL 16 (Docker) |
| ORM + Migrations | Drizzle ORM + drizzle-kit |
| Validação de env | Zod |
| Autenticação JWT | jose (RS256 via JWKS remoto) |

## Autenticação e Autorização

Todos os endpoints exigem um **JWT de acesso** emitido pelo serviço de autenticação (`0x_t1`).

### Fluxo

1. O cliente obtém um token via `POST /auth/login` no Auth Service.
2. Envia o token no header `Authorization: Bearer <token>`.
3. O `authPlugin` valida a assinatura RS256 buscando a chave pública em `AUTH_SERVICE_URL/.well-known/jwks.json`.
4. Tokens com `type != "access"` (ex: refresh tokens) são rejeitados com `401`.
5. Endpoints protegidos usam `requireScope('manager')` — retorna `403` se o scope estiver ausente.

### Scopes

| Scope | Permissões |
|---|---|
| `participant` | Leitura (GET em todos os endpoints) |
| `manager` | Leitura + escrita (POST, PUT, PATCH, DELETE) |
| `admin` | Inclui todos os scopes anteriores |

### Respostas de erro

| Código | Motivo |
|---|---|
| `401` | Token ausente, inválido, expirado ou `type=refresh` |
| `403` | Token válido mas sem o scope exigido |

---

## Como rodar localmente

### Pré-requisitos

- Node.js 22+
- Docker + Docker Compose
- Auth Service (`0x_t1`) rodando em `http://localhost:8080`

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` se precisar alterar usuário, senha, porta do banco ou URL dos serviços externos.

| Variável | Descrição | Padrão |
|---|---|---|
| `PORT` | Porta do servidor | `3000` |
| `DATABASE_URL` | Connection string do PostgreSQL | `postgresql://...@localhost:5432/events_db` |
| `AUTH_SERVICE_URL` | URL base do Auth Service (para buscar JWKS) | `http://localhost:8080` |
| `REGISTRATION_SERVICE_URL` | URL base do Registration Service (opcional) | _(vazio — métricas usam 0 como fallback)_ |

### 3. Subir o banco de dados

```bash
npm run db:up
```

Sobe um container PostgreSQL 16 na porta `5432` com volume persistente.

### 4. Aplicar as migrations

```bash
npm run db:migrate
```

Cria as tabelas `events`, `activities` e `event_roles` no banco.

### 5. Subir o Auth Service

O Auth Service (`0x_t1`) deve estar rodando antes de iniciar a API. A partir da raiz do monorepo:

```bash
docker compose -f 0x_t1/docker-compose.yml up -d
```

Usuários de desenvolvimento disponíveis após o seed:

| Email | Senha | Scope |
|---|---|---|
| `admin@local.dev` | `Admin@123` | `participant`, `manager`, `admin` |
| `manager@local.dev` | `Manager@123` | `participant`, `manager` |

### 6. Iniciar o servidor

```bash
npm run dev
```

Servidor disponível em `http://localhost:3000`  
Swagger UI disponível em `http://localhost:3000/docs`

### 7. Rodar os testes

```bash
npm test
```

---

## Scripts

```bash
npm run dev            # servidor com hot-reload
npm run build          # compila TypeScript → dist/
npm run start          # executa build compilado
npm run lint           # verifica qualidade do código com ESLint
npm run test           # roda testes com Vitest
npm run generate-spec  # gera docs/openapi.json

npm run db:up          # sobe o PostgreSQL via Docker Compose
npm run db:down        # para e remove o container
npm run db:generate    # gera arquivos de migration a partir do schema
npm run db:migrate     # aplica migrations no banco
npm run db:studio      # abre o Drizzle Studio (interface visual do banco)
```

A documentação interativa fica disponível em `http://localhost:3000/docs` após iniciar o servidor.

---

## Arquitetura

### Componentes do Sistema

```mermaid
graph TB
    subgraph EXT["Externos"]
        CLIENT["Cliente HTTP"]
        BROWSER["Browser — Swagger UI"]
        GHPAGES["GitHub Pages\ndocs/openapi.json"]
        AUTH["Auth Service · :8080\nJWKS · /well-known/jwks.json"]
        REG["Registration Service\n(opcional)"]
    end

    subgraph SRV["Fastify Server — :3000"]
        direction TB

        subgraph BOOT["Bootstrap · index.ts"]
            MAIN["main()"]
        end

        subgraph PLG["Plugins  (ordem de registro)"]
            SP["1 · swaggerPlugin\n@fastify/swagger + @fastify/swagger-ui\nOpenAPI 3.1  ·  /docs"]
            SCP["2 · schemasPlugin\nregistra 13 TypeBox schemas\ncomo componentes OpenAPI reutilizáveis"]
            AP["3 · authPlugin\nvalida JWT RS256 via JWKS remoto\nrejeita type=refresh · decora req.user"]
        end

        subgraph RT["Routes"]
            ER["eventsRoutes\nevents.routes.ts\n16 endpoints"]
        end

        subgraph REPOS["Repositories"]
            EREP["eventRepository"]
            AREP["activityRepository"]
            RREP["roleRepository"]
            MREP["metricsRepository"]
        end

        subgraph CLI["Clients"]
            RCLI["registrationClient\n(fetch + timeout 5s)"]
        end

        subgraph SCH["TypeBox Schemas"]
            direction LR
            ES["event.schema\nEvent · CreateEventBody\nUpdateEvent · EventListResponse"]
            SS["activity.schema\nActivity · CreateActivityBody\nUpdateActivity"]
            RS["event-role.schema\nEventRole · CreateEventRole"]
            MS["metrics.schema\nEventMetrics · EventsMetrics"]
        end
    end

    subgraph DB["PostgreSQL — :5432"]
        TB1["events"]
        TB2["activities"]
        TB3["event_roles"]
    end

    subgraph CICD["CI/CD · GitHub Actions"]
        WF["docs.yml\npush → main"]
        GS["generate-spec.ts\n(tsx)"]
        OJ["docs/openapi.json"]
    end

    CLIENT -->|"REST JSON\nBearer token"| ER
    BROWSER -->|"GET /docs"| SP
    AP -->|"GET /.well-known/jwks.json"| AUTH
    RCLI -->|"GET /registrations/count"| REG

    MAIN -->|"register"| SP
    MAIN -->|"register"| SCP
    MAIN -->|"register"| AP
    MAIN -->|"register"| ER

    ES & SS & RS & MS -->|"addSchema()"| SCP
    SCP -->|"validação via $ref"| ER

    ER --> EREP & AREP & RREP & MREP & RCLI
    EREP & AREP & RREP & MREP --> DB

    WF -->|"npm run generate-spec"| GS
    GS -->|"server.swagger()"| OJ
    OJ -->|"deploy pages"| GHPAGES
```

---

### Fluxo de Inicialização e Ciclo de Requisição

```mermaid
sequenceDiagram
    actor Dev
    participant idx  as index.ts
    participant sw   as swaggerPlugin
    participant sch  as schemasPlugin
    participant auth as authPlugin
    participant rt   as eventsRoutes
    participant cli  as Cliente HTTP
    participant jwks as Auth Service JWKS

    Dev->>idx: npm run dev
    idx->>sw: register(swaggerPlugin)
    sw-->>idx: OpenAPI 3.1 pronto · /docs ativo

    idx->>sch: register(schemasPlugin)
    sch-->>idx: 13 schemas adicionados ao Fastify

    idx->>auth: register(authPlugin)
    auth-->>idx: onRequest hook registrado globalmente

    idx->>rt: register(eventsRoutes)
    rt-->>idx: 16 endpoints registrados

    idx-->>Dev: Servidor ouvindo em :3000

    Note over cli,jwks: Requisição autenticada
    cli->>auth: GET /events · Bearer <token>
    auth->>jwks: GET /.well-known/jwks.json
    jwks-->>auth: chave pública RS256
    auth-->>auth: verifica assinatura · valida type=access
    auth-->>rt: req.user = { id, scopes, principalType }
    rt-->>cli: 200 OK

    Note over cli,rt: Requisição com escopo insuficiente
    cli->>auth: POST /events · Bearer <token participant>
    auth-->>rt: req.user.scopes = ["participant"]
    rt-->>rt: requireScope("manager") → faltando
    rt-->>cli: 403 Forbidden
```

---

### Modelo de Dados

```mermaid
classDiagram
    direction TB

    class Event {
        +String id
        +String title
        +String? description
        +DateTime starts_at
        +DateTime ends_at
        +String timezone
        +DateTime? registration_deadline
        +Location? location
        +Integer capacity
        +String? category
        +String? language
        +DateTime created_at
        +DateTime updated_at
        +DateTime|null deleted_at
        +String|null deleted_by
        +String created_by
    }

    class Location {
        +String? venue
        +String? address
        +String? city
        +String? state
        +String? country
    }

    class Activity {
        +String id_activity
        +String title_activity
        +String? description_activity
        +String type
        +DateTime starts_at
        +DateTime ends_at
        +String timezone
        +String? thumbnail_url
        +Integer? capacity_activity
        +Integer workload_minutes
        +DateTime? registration_deadline_activity
        +String? category_activity
        +String? language_activity
        +DateTime created_at
        +DateTime updated_at
        +DateTime|null deleted_at
        +String|null deleted_by
        +String created_by
    }

    class EventRole {
        +String event_id
        +String role
    }

    class EventMetrics {
        +String event_id
        +Integer capacity
        +Integer enrolled
        +Integer available_spots
        +Number occupancy_percentage
        +ActivityBreakdown activitys
    }

    class ActivityBreakdown {
        +Integer total
        +Record~String·Integer~ by_type
        +Integer total_workload_minutes
    }

    class EventsMetrics {
        +Integer total_events
        +Integer total_activitys
        +Integer total_capacity
        +Integer total_enrolled
        +Integer total_available_spots
        +Number average_occupancy_percentage
        +Record~String·Integer~ events_by_category
        +EventsByStatus events_by_status
    }

    class EventsByStatus {
        +Integer upcoming
        +Integer ongoing
        +Integer past
    }

    Event "1" *-- "1" Location           : location
    Event "1" *-- "0..*" Activity         : activitys
    Event "1" *-- "0..*" EventRole       : roles
    Event "1" ..> "1" EventMetrics       : métricas por evento
    EventMetrics "1" *-- "1" ActivityBreakdown
    EventsMetrics "1" *-- "1" EventsByStatus
```

---

### Endpoints da API

> Endpoints marcados com 🔒 exigem scope `manager`. Todos os endpoints exigem token válido.

```mermaid
graph LR
    subgraph EVENTS["tag: Events"]
        E1["🔒 POST   /events\nCria evento"]
        E2["GET    /events\nLista com paginação\n?page · ?limit"]
        E3["GET    /events/metrics\nMétricas agregadas\n(consulta Registration Service)"]
        E4["GET    /events/:id\nBusca por ID"]
        E5["🔒 PUT    /events/:id\nAtualização completa"]
        E6["🔒 PATCH  /events/:id\nAtualização parcial"]
        E7["🔒 DELETE /events/:id\nSoft delete · deleted_at"]
    end

    subgraph ACTIVITIES["tag: Activitys"]
        A1["GET    /events/:id/activitys\nLista atividades do evento"]
        A2["🔒 POST   /events/:id/activitys\nCria atividade"]
        A3["🔒 PUT    /events/:id/activitys/:activityId\nAtualização completa"]
        A4["🔒 PATCH  /events/:id/activitys/:activityId\nAtualização parcial"]
        A5["🔒 PUT    /events/:id/activitys/:activityId/thumbnail\nDefine thumbnail"]
        A6["🔒 DELETE /events/:id/activitys/:activityId\nSoft delete"]
    end

    subgraph ROLES["tag: Roles"]
        R1["GET    /events/:id/roles\nLista roles do evento"]
        R2["🔒 POST   /events/:id/roles\nAdiciona role"]
        R3["🔒 DELETE /events/:id/roles/:role\nRemove role"]
    end

    subgraph SCHEMAS["Schemas de resposta"]
        SC1["Event"]
        SC2["EventListResponse"]
        SC3["EventsMetrics"]
        SC4["Activity"]
        SC5["EventRole"]
    end

    E1 -->|"201"| SC1
    E2 -->|"200"| SC2
    E3 -->|"200"| SC3
    E4 & E5 & E6 & E7 -->|"200"| SC1
    A1 & A2 & A3 & A4 & A5 & A6 -->|"200/201"| SC4
    R1 & R2 -->|"200/201"| SC5
```

---

### Pipeline CI/CD

**ci.yml** — executa em todo push e PR para `dev` e `main`:

```mermaid
flowchart LR
    TRIGGER(["Push / PR\n→ dev ou main"])
    CO["checkout@v4"]
    ND["setup-node@v4\nNode 22  ·  cache npm"]
    NI["npm ci"]
    LN["npm run lint\nESLint + typescript-eslint"]
    TC["npm run build\ntsc — type check"]
    UT["npm test\nVitest — testes unitários"]
    OK(["✓ CI passou"])

    TRIGGER --> CO --> ND --> NI --> LN --> TC --> UT --> OK
```

**docs.yml** — executa no merge para `main`:

```mermaid
flowchart LR
    PUSH(["Push → main\nou workflow_dispatch"])
    CO["checkout@v4"]
    ND["setup-node@v4\nNode 22  ·  cache npm"]
    CI["npm ci"]
    GS["npm run generate-spec\ntsx scripts/generate-spec.ts\n\ninstancia Fastify em memória\nexporta server.swagger()"]
    OJ["docs/openapi.json\nartefato gerado"]
    CFG["configure-pages@v5"]
    UP["upload-pages-artifact@v3\npath: docs/"]
    DP["deploy-pages@v4"]
    GP(["GitHub Pages\nOpenAPI spec pública"])

    PUSH --> CO --> ND --> CI --> GS --> OJ --> CFG --> UP --> DP --> GP
```
