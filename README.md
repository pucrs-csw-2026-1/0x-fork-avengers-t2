# Events API

API REST para gerenciamento de eventos, seções e matrículas, construída com **Fastify 5** e **TypeBox**.

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Fastify 5 |
| Schemas / Validação | @sinclair/typebox 0.34 |
| Documentação | @fastify/swagger + @fastify/swagger-ui |
| Linguagem | TypeScript 5 |
| Testes | Vitest 2 |
| Runtime dev | tsx |
| Banco de dados | PostgreSQL 16 (Docker) |
| ORM + Migrations | Drizzle ORM + drizzle-kit |
| Validação de env | Zod |

## Como rodar localmente

### Pré-requisitos

- Node.js 22+
- Docker + Docker Compose

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` se precisar alterar usuário, senha ou porta do banco. Os valores padrão já funcionam com o Docker Compose incluído.

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

### 5. Iniciar o servidor

```bash
npm run dev
```

Servidor disponível em `http://localhost:3000`  
Swagger UI disponível em `http://localhost:3000/docs`

### 6. Rodar os testes

```bash
npm test
```

---

## Scripts

```bash
npm run dev            # servidor com hot-reload
npm run build          # compila TypeScript → dist/
npm run start          # executa build compilado
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
    end

    subgraph SRV["Fastify Server — :3000"]
        direction TB

        subgraph BOOT["Bootstrap · index.ts"]
            MAIN["main()"]
        end

        subgraph PLG["Plugins  (ordem de registro)"]
            SP["1 · swaggerPlugin\n@fastify/swagger + @fastify/swagger-ui\nOpenAPI 3.1  ·  /docs"]
            SCP["2 · schemasPlugin\nregistra 8 TypeBox schemas\ncomo componentes OpenAPI reutilizáveis"]
        end

        subgraph RT["Routes"]
            ER["eventsRoutes\nevents.routes.ts"]
        end

        subgraph SCH["TypeBox Schemas"]
            direction LR
            ES["event.schema\nEvent · CreateEvent\nUpdateEvent · EventListResponse"]
            SS["activity.schema\nActivity"]
            RS["event-role.schema\nEventRole · CreateEventRole"]
            MS["metrics.schema\nEventMetrics · EventsMetrics"]
        end
    end

    subgraph CICD["CI/CD · GitHub Actions"]
        WF["docs.yml\npush → main"]
        GS["generate-spec.ts\n(tsx)"]
        OJ["docs/openapi.json"]
    end

    CLIENT -->|"REST JSON"| ER
    BROWSER -->|"GET /docs"| SP

    MAIN -->|"register"| SP
    MAIN -->|"register"| SCP
    MAIN -->|"register"| ER

    ES & SS & RS & MS -->|"addSchema()"| SCP
    SCP -->|"validação via $ref"| ER

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
    participant rt   as eventsRoutes
    participant cli  as Cliente HTTP

    Dev->>idx: npm run dev
    idx->>sw: register(swaggerPlugin)
    sw-->>idx: OpenAPI 3.1 pronto · /docs ativo

    idx->>sch: register(schemasPlugin)
    sch-->>idx: 8 schemas adicionados ao Fastify

    idx->>rt: register(eventsRoutes)
    rt-->>idx: 11 endpoints registrados

    idx-->>Dev: Servidor ouvindo em :3000

    Note over cli,rt: Exemplo de requisição
    cli->>rt: GET /events/metrics
    rt->>sch: validar response → EventsMetrics#
    sch-->>rt: schema válido
    rt-->>cli: 200 OK · EventsMetrics payload

    cli->>rt: POST /events/:id/roles
    rt->>sch: validar body → CreateEventRole#
    sch-->>rt: schema válido
    rt-->>cli: 201 Created · EventRole payload
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
        +Integer? capacity_activity
        +Integer workload_minutes
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

```mermaid
graph LR
    subgraph EVENTS["tag: Events"]
        E1["POST   /events\nCria evento"]
        E2["GET    /events\nLista com paginação\n?page · ?limit"]
        E3["GET    /events/metrics\nMétricas agregadas"]
        E4["GET    /events/:id\nBusca por ID"]
        E5["PUT    /events/:id\nAtualização completa"]
        E6["PATCH  /events/:id\nAtualização parcial"]
        E7["DELETE /events/:id\nSoft delete · deleted_at"]
    end

    subgraph SECTIONS["tag: Activitys"]
        S1["GET /events/:id/activitys\nLista seções do evento"]
    end

    subgraph ROLES["tag: Roles"]
        R1["GET    /events/:id/roles\nLista roles do evento"]
        R2["POST   /events/:id/roles\nAdiciona role"]
        R3["DELETE /events/:id/roles/:role\nRemove role"]
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
    S1 -->|"200"| SC4
    R1 & R2 -->|"200/201"| SC5
```

---

### Pipeline CI/CD

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
