# Roadmap do Projeto — GCET512 (2026.2)

## Questify — Plataforma Gamificada de Produtividade Acadêmica

> "Transforme sua rotina de estudos em uma jornada de RPG."

---

## 1. Visão Geral

**Questify** é um sistema web que gamifica a vida acadêmica: tarefas, hábitos de
estudo, projetos em grupo e eventos de campus viram **quests** que dão XP,
sobem de nível o usuário, desbloqueiam badges e alimentam rankings entre
squads/turmas. Pontos acumulados (Gold) podem ser trocados em uma
**loja de recompensas** (folgas em trabalhos, brindes, cupons de parceiros,
cosméticos de perfil). Usuários se organizam em **guildas** (grupos de
estudo/squads da turma), competem em **leaderboards** e recebem
**notificações em tempo real** sobre progresso, prazos e conquistas.

### Por que este tema

- **Atraente e motivador**: mecânicas de gamificação (XP, níveis, loot,
  guildas) são familiares e divertidas para a turma, o que aumenta o
  engajamento com o próprio projeto da disciplina — os alunos constroem algo
  que gostariam de usar.
- **Modularidade natural**: o domínio se decompõe em serviços de
  responsabilidade única e bem delimitada (identidade, regras de
  gamificação, social, economia virtual, notificações, analytics, frontend,
  plataforma), o que é exatamente o que se precisa para dividir o trabalho
  entre até 8 squads com interfaces de API claras.
- **Cobre o ciclo de vida completo**: tem regras de negócio não triviais
  (motor de XP/leveling), estado compartilhado entre serviços (eventos de
  domínio), necessidade real de testes automatizados (cálculo de pontos,
  concorrência em resgates de loja), e uma superfície grande o suficiente
  para justificar CI/CD, containers e observabilidade de verdade.
- **Escala com o tamanho da turma**: com menos squads, módulos podem ser
  fundidos (ver seção 8); com 8 squads, cada um tem escopo cheio.

---

## 2. Arquitetura do Produto e Divisão em Squads

Arquitetura de **microsserviços por domínio**, atrás de um **API Gateway**,
comunicando-se via **API REST síncrona** (contratos OpenAPI) para consultas e
um **barramento de eventos assíncrono** (fila de mensagens) para efeitos
colaterais entre domínios (ex.: "quest concluída" dispara ganho de XP,
atualização de ranking e notificação, sem acoplar os três serviços entre si).

```
                        ┌────────────────────────┐
                        │   Squad 7 — Web App      │
                        │  (Frontend SPA/PWA)      │
                        └───────────┬──────────────┘
                                    │ HTTPS / REST
                        ┌───────────▼──────────────┐
                        │  Squad 8 — API Gateway /  │
                        │  Plataforma & DevOps       │
                        └─┬────┬────┬────┬────┬────┘
              ┌───────────┘    │    │    │    └───────────┐
    ┌─────────▼───┐ ┌──────────▼─┐ ┌▼───────────┐ ┌────────▼────────┐
    │ Squad 1      │ │ Squad 2    │ │ Squad 3     │ │ Squad 4          │
    │ Identity &   │ │ Quests &   │ │ Guildas &   │ │ Marketplace &    │
    │ Access       │ │ Gamificação│ │ Social      │ │ Recompensas      │
    └──────┬───────┘ └─────┬──────┘ └──────┬──────┘ └────────┬─────────┘
           │               │               │                 │
           └───────────────┴───────┬───────┴─────────────────┘
                                    │  Event Bus (RabbitMQ/Kafka)
                        ┌───────────┴──────────────┐
                        │   Squad 5 — Notificações  │
                        │   & Realtime               │
                        └────────────────────────────┘
                        ┌────────────────────────────┐
                        │   Squad 6 — Leaderboard &   │
                        │   Analytics                 │
                        └────────────────────────────┘
```

### Squad 1 — Identidade & Acesso (`auth-service`)
- **Responsabilidades**: cadastro/login, perfis de usuário, autenticação
  (JWT/OAuth2), autorização (papéis: aluno, monitor, admin), emissão do
  token usado por todos os outros serviços.
- **Stack sugerida**: Node.js (NestJS) ou Spring Boot; PostgreSQL; JWT;
  bcrypt/argon2 para senhas.
- **Entrega-chave**: emitir/validar tokens que os demais squads consomem —
  é o serviço do qual todos dependem primeiro.

### Squad 2 — Quests & Motor de Gamificação (`quest-service`)
- **Responsabilidades**: CRUD de quests/tarefas, submissão/validação de
  conclusão, cálculo de XP e regras de leveling, badges/conquistas.
- **Stack sugerida**: Python (FastAPI) ou Java (Spring Boot); PostgreSQL;
  motor de regras simples (state machine de progresso).
- **Entrega-chave**: publica evento `QuestCompleted` / `UserLeveledUp` no
  barramento para os squads 4, 5 e 6 reagirem.

### Squad 3 — Guildas & Social (`social-service`)
- **Responsabilidades**: grupos de estudo (guildas), feed de atividades,
  amizades/seguidores, comentários/reações em conquistas.
- **Stack sugerida**: Node.js/Express ou Django; PostgreSQL ou MongoDB
  (feed); WebSocket opcional para feed ao vivo.
- **Entrega-chave**: API de guildas consumida pelo leaderboard (ranking por
  guilda) e pelo frontend.

### Squad 4 — Marketplace & Recompensas (`rewards-service`)
- **Responsabilidades**: catálogo de recompensas, saldo de Gold, resgates
  (com controle de concorrência/estoque), histórico de transações.
- **Stack sugerida**: Go ou Spring Boot; PostgreSQL com transações ACID;
  atenção especial a testes de concorrência (evitar resgate duplicado).
- **Entrega-chave**: consumir XP/Gold creditado via eventos de Quest e
  garantir consistência no débito ao resgatar.

### Squad 5 — Notificações & Realtime (`notification-service`)
- **Responsabilidades**: consumir eventos do barramento, disparar
  notificações (in-app via WebSocket, e-mail), central de notificações do
  usuário.
- **Stack sugerida**: Node.js + Socket.io, ou Go; RabbitMQ/Kafka consumer;
  provedor de e-mail (ex.: SMTP de teste/Mailhog em dev).
- **Entrega-chave**: pipeline evento → notificação com baixa latência,
  testável com filas locais em CI.

### Squad 6 — Leaderboard & Analytics (`analytics-service`)
- **Responsabilidades**: rankings (individual, por guilda, por turma),
  dashboards de progresso, relatórios agregados, exportação de dados.
- **Stack sugerida**: Python (FastAPI/Pandas) ou Node.js; banco analítico
  simples (PostgreSQL com views materializadas, ou Redis para rankings em
  tempo real via sorted sets).
- **Entrega-chave**: agregações a partir dos eventos publicados pelos
  squads 2 e 3, expostas como API de leitura para o frontend.

### Squad 7 — Aplicação Web (Frontend)
- **Responsabilidades**: SPA/PWA que consome todas as APIs via gateway,
  UX de gamificação (barra de XP, avatar, loja, feed, rankings),
  responsividade e acessibilidade.
- **Stack sugerida**: React ou Vue + TypeScript; Vite; Tailwind/Design
  System próprio; testes com Playwright/Cypress.
- **Entrega-chave**: é o squad mais dependente de contratos de API
  estáveis — trabalha desde a semana 1 com mocks (ex.: MSW) contra os
  OpenAPI specs publicados pelos demais squads.

### Squad 8 — Plataforma, Gateway & DevOps
- **Responsabilidades**: API Gateway (roteamento, rate limiting), ambiente
  de staging compartilhado, pipelines de CI/CD reutilizáveis, observabilidade
  (logs, métricas, tracing), infraestrutura como código, gestão do
  barramento de eventos.
- **Stack sugerida**: Docker Compose (ou Kubernetes se a turma tiver
  maturidade), Nginx/Traefik ou Kong como gateway, GitHub Actions,
  Prometheus + Grafana, Loki/ELK para logs, Terraform opcional.
- **Entrega-chave**: é o squad "habilitador" — sobe o esqueleto de infra
  na semana 1–2 para os demais squads terem onde publicar seus serviços
  desde cedo (ambiente de staging comum, template de pipeline).

---

## 3. Contratos de Integração entre Squads

1. **Contrato de API (síncrono)**: todo squad de backend publica e mantém
   atualizado um arquivo `openapi.yaml` no seu repositório/pasta desde a
   Sprint 1 (mesmo com endpoints ainda não implementados — "contract
   first"). Mudanças breaking exigem aviso com 1 sprint de antecedência no
   canal de integração.
2. **Contrato de eventos (assíncrono)**: catálogo central de eventos de
   domínio (`QuestCompleted`, `UserLeveledUp`, `GoldEarned`,
   `RewardRedeemed`, `GuildJoined`, etc.) com schema versionado (JSON
   Schema), documentado em `/docs/events.md` no repositório principal.
   Produtores e consumidores concordam no formato antes de implementar.
3. **Autenticação uniforme**: todo serviço valida o mesmo JWT emitido pelo
   Squad 1 (chave pública compartilhada); nenhum outro squad reimplementa
   login.
4. **Ambiente de staging compartilhado** (mantido pelo Squad 8): cada
   squad publica sua imagem Docker via CI; o `docker-compose.staging.yml`
   (ou manifests k8s) do repositório raiz orquestra todos os serviços
   juntos, atualizado a cada merge na branch principal de cada squad.
5. **Dias de Integração**: ao final de cada sprint há um horário fixo de
   "Integration Day" em que todos os squads sobem no staging compartilhado
   e validam handshakes entre serviços (ver roadmap).
6. **Repositório**: recomenda-se monorepo com uma pasta por squad
   (`/services/auth-service`, `/services/quest-service`, ...) + pasta
   `/docs` para contratos e `/platform` para IaC/pipelines do Squad 8 —
   facilita revisão cruzada e um único `docker-compose` de staging.

---

## 4. Papéis dentro de cada Squad (4 pessoas)

Com apenas 4 integrantes, papéis se acumulam. Sugestão de distribuição:

| Papel | Responsabilidade principal | Observação |
|---|---|---|
| **Product Owner (PO)** | Prioriza backlog do módulo, escreve histórias de usuário, valida entregas com o "cliente" (professor/monitor) | Também atua como Dev |
| **Scrum Master** | Facilita cerimônias, remove impedimentos, acompanha métricas de sprint (burndown, velocity) | Também atua como Dev |
| **Dev Backend/Frontend** (x2 a x4) | Implementação das histórias, revisão de código dos colegas | Todos revisam PRs uns dos outros |
| **QA / DevOps rotativo** | Garante cobertura de testes automatizados e saúde do pipeline de CI/CD da sprint | Papel **rotativo a cada sprint** entre os 4 membros |

Cada membro deve, ao longo do semestre, ter passado por pelo menos um ciclo
como PO, um como Scrum Master e pelo menos duas sprints como responsável por
QA/DevOps — o objetivo pedagógico é que todos vivenciem todos os papéis, não
apenas especializem.

---

## 5. Roadmap por Sprint (Semestre de 17 semanas)

Sprints de 2 semanas (exceto Sprint 0 e a semana final de encerramento).
Cada sprint tem um dia fixo de **Sprint Review + Integration Day** com todas
as squads presentes.

### Sprint 0 — Fundação (Semanas 1–2)
- Formação das squads, apresentação do tema Questify e da arquitetura geral.
- Cada squad escreve sua **visão de módulo**, personas afetadas e
  **backlog inicial** (histórias de usuário no formato INVEST) no board
  (ex.: GitHub Projects/Jira/Trello).
- Definição de "Definition of Ready" e "Definition of Done" da turma.
- Squad 8 sobe o esqueleto de infraestrutura: repositório(s), template de
  pipeline CI, ambiente de staging vazio, catálogo inicial de eventos.
- Squad 1 desenha o contrato de autenticação (OpenAPI do `auth-service`).
- **Entregável**: backlog priorizado por squad + `openapi.yaml` inicial
  (mesmo que só com stubs) + repositório com CI "hello world" rodando.
- **Avaliação**: clareza do backlog, qualidade das histórias de usuário,
  pipeline de CI executando (ainda que vazio).

### Sprint 1 (Semanas 3–4) — MVP de cada serviço isolado
- Implementação do esqueleto de cada serviço (rotas básicas, banco de
  dados, containerização).
- Squad 1 entrega cadastro/login funcional; demais squads consomem o
  contrato via mocks.
- Testes unitários desde o primeiro commit (meta: cobertura mínima
  definida pela turma, ex. 60%).
- **Integration Day 1**: validar que o `auth-service` está no ar em
  staging e que os demais squads conseguem obter um token válido.
- **Entregável**: cada squad com serviço rodando em container, testes
  unitários básicos, CI rodando lint + testes a cada PR.
- **Avaliação**: build verde no CI, testes unitários existentes e
  relevantes, code review registrado nos PRs.

### Sprint 2 (Semanas 5–6) — Regras de negócio centrais
- Squad 2: motor de XP/leveling completo e publicação do evento
  `QuestCompleted`/`UserLeveledUp`.
- Squad 3: CRUD de guildas e feed básico.
- Squad 4: catálogo de recompensas e saldo de Gold (ainda sem consumir
  eventos).
- Squad 5/6/8: consumidores de evento de teste (esqueleto), dashboards
  Grafana iniciais, gateway roteando ao menos 2 serviços reais.
- Squad 7: telas principais com dados mockados (MSW) seguindo os
  contratos OpenAPI publicados.
- **Entregável**: primeira demonstração ponta a ponta parcial (login →
  completar quest → ver XP subir).
- **Avaliação**: aderência ao contrato de API/eventos, testes de regra de
  negócio (casos de borda do cálculo de XP), demo funcional.

### Sprint 3 (Semanas 7–8) — Integração assíncrona
- Barramento de eventos em produção entre squads 2 → 4, 5, 6.
- Squad 4 implementa resgate de recompensas com testes de concorrência.
- Squad 5 entrega notificações em tempo real (WebSocket) no frontend.
- Squad 6 entrega leaderboard por usuário e por guilda.
- **Integration Day 3**: fluxo completo "quest concluída → XP e Gold
  creditados → notificação disparada → ranking atualizado" testado ao
  vivo com todas as squads.
- **Entregável**: fluxo ponta a ponta funcional em staging.
- **Avaliação**: testes de integração cobrindo o fluxo entre serviços,
  observabilidade mínima (logs estruturados, métricas básicas expostas).

### Sprint 4 (Semanas 9–10) — Qualidade e testes automatizados (foco)
- Cada squad amplia sua pirâmide de testes: unitários + integração +
  contract tests (ex.: Pact ou validação de schema OpenAPI) + ao menos um
  fluxo E2E crítico do seu módulo (Playwright/Cypress no frontend,
  supertest/RestAssured no backend).
- Squad 8 integra os testes ao pipeline como gate obrigatório de merge.
- Revisão de dívida técnica acumulada (spike de refactor, se necessário).
- **Entregável**: relatório de cobertura de testes por squad, pipeline com
  gate de qualidade (testes + lint + build) bloqueando merges quebrados.
- **Avaliação**: cobertura de testes, qualidade dos testes (não apenas
  quantidade — casos de erro/borda), tempo de pipeline.

### Sprint 5 (Semanas 11–12) — Hardening e observabilidade
- Tratamento de erros e resiliência (timeouts, retries, circuit breaker
  básico no gateway).
- Squad 8 consolida dashboards de saúde do sistema (latência, taxa de
  erro, throughput) e alertas simples.
- Segurança básica: validação de entrada, rate limiting no gateway,
  gestão de segredos (nada de credenciais hardcoded).
- **Integration Day 5**: teste de carga leve no ambiente de staging
  (ex.: k6/Locust) simulando uso concorrente entre squads.
- **Entregável**: dashboard de observabilidade compartilhado, checklist de
  segurança básico atendido por todos os serviços.
- **Avaliação**: resiliência a falhas simuladas (ex.: derrubar um serviço
  e observar degradação controlada), qualidade dos dashboards.

### Sprint 6 (Semanas 13–14) — Feature freeze de escopo + polimento
- Congelamento de novas funcionalidades grandes; foco em UX, bugs,
  débito técnico e testes faltantes.
- Squad 7 finaliza responsividade, acessibilidade básica (labels,
  contraste, navegação por teclado).
- Deploy contínuo (CD) real para o ambiente de staging a cada merge na
  branch principal.
- **Entregável**: release candidate do sistema completo publicado em
  staging via pipeline automatizado (sem deploy manual).
- **Avaliação**: ausência de bugs críticos abertos, changelog claro,
  pipeline de deploy contínuo funcionando de ponta a ponta.

### Sprint 7 (Semanas 15–16) — Ensaio geral e retrospectiva final
- Ensaio da demo integrada completa entre todos os squads.
- Retrospectiva de todo o semestre por squad (o que funcionou, o que não
  funcionou, métricas de velocity ao longo do tempo).
- Documentação final: README de cada serviço, diagrama de arquitetura
  atualizado, runbook de operação básico.
- **Entregável**: documentação completa + sistema estável em staging.
- **Avaliação**: qualidade da documentação, evolução de velocity/qualidade
  ao longo do semestre (usado como evidência de maturidade do time).

### Semana 17 — Demo Day
- Apresentação final integrada do Questify funcionando de ponta a ponta,
  com todos os 8 módulos ativos simultaneamente.
- Cada squad apresenta: demo ao vivo do seu módulo, decisões de
  arquitetura, principais aprendizados, métricas de qualidade (cobertura
  de testes, uptime em staging, nº de incidentes tratados).
- **Avaliação final**: nota combinada de (a) funcionamento real do
  sistema integrado, (b) qualidade de engenharia (testes, CI/CD,
  observabilidade), (c) processo ágil seguido (histórico de sprints,
  retrospectivas), (d) apresentação e clareza técnica.

---

## 6. Critérios de Avaliação por Fase

Cada sprint é avaliada com o mesmo esqueleto de rubrica, ponderado conforme o
foco daquela fase:

| Dimensão | O que se observa |
|---|---|
| **Processo ágil** | Backlog atualizado, histórias bem escritas, sprint planning/review/retro registradas, velocity acompanhada |
| **Engenharia** | Qualidade do código (revisões de PR reais, não só aprovação automática), aderência aos contratos de API/eventos |
| **Testes** | Presença e qualidade de testes unitários, de integração e (quando aplicável) E2E; testes cobrindo casos de erro, não só o caminho feliz |
| **DevOps** | Pipeline de CI passando, containerização correta, deploy automatizado para staging, observabilidade mínima |
| **Colaboração** | Evidência de rotação de papéis, comunicação entre squads (issues, contratos, integration days), resolução de bloqueios |

A nota final do semestre pondera: 40% funcionamento técnico do módulo e do
sistema integrado, 25% qualidade de testes/CI-CD, 20% processo ágil (uso
real do board, retros, papéis rotativos), 15% apresentação e documentação.

---

## 7. Práticas de DevOps e Qualidade Esperadas (transversais a todos os squads)

- **Controle de versão**: Git Flow simplificado — branch `main` protegida,
  `develop` (opcional) e branches de feature nomeadas
  (`feature/<squad>-<descrição>`); nenhum push direto na `main`, apenas via
  Pull Request.
- **Code Review obrigatório**: todo PR exige ao menos 1 aprovação de outro
  membro do squad antes do merge; PRs entre squads (mudança de contrato)
  exigem aprovação de um representante do squad consumidor.
- **CI**: pipeline mínimo por serviço — lint → build → testes unitários →
  testes de integração → build de imagem Docker → publicação em registry.
- **CD**: deploy automático para o ambiente de staging compartilhado a cada
  merge na branch principal, a partir da Sprint 6 (antes disso, deploy pode
  ser sob demanda).
- **Containers**: todo serviço deve rodar via Docker; `docker-compose` (ou
  manifests k8s, se a turma optar) reproduz o ambiente completo localmente.
- **Testes automatizados**: pirâmide de testes obrigatória — unitários (a
  maioria), integração (fluxos entre 2+ componentes do próprio serviço),
  E2E/contract tests (fluxos críticos entre squads). Nenhuma sprint a
  partir da Sprint 1 deve regredir cobertura.
- **Observabilidade**: logs estruturados (JSON) em todos os serviços,
  métricas expostas (ex.: endpoint `/metrics` Prometheus), dashboard
  central mantido pelo Squad 8.
- **Gestão de segredos e configuração**: variáveis sensíveis via `.env`
  não versionado / secrets do CI; nunca credenciais hardcoded no código.
- **Documentação viva**: README por serviço com como rodar localmente,
  contrato de API (OpenAPI) sempre atualizado, catálogo de eventos
  versionado.

---

## 8. Ajustando para Menos de 8 Squads

Se a turma formar menos de 8 squads, fundir módulos nesta ordem de
prioridade (do menos crítico isoladamente ao mais crítico manter separado):

1. Fundir **Squad 6 (Leaderboard & Analytics)** dentro do **Squad 2
   (Quests)** — ambos already compartilham os mesmos eventos de origem.
2. Fundir **Squad 5 (Notificações)** dentro do **Squad 3 (Guildas &
   Social)** — notificações são majoritariamente sociais no Questify.
3. Fundir **Squad 4 (Marketplace)** dentro do **Squad 2 (Quests)**,
   formando um squad único de "Economia & Progresso".
4. Nunca fundir **Squad 1 (Identidade)**, **Squad 7 (Frontend)** ou
   **Squad 8 (Plataforma/DevOps)** — são os três papéis estruturais que
   todo o resto depende para existir.

Com 4 squads, por exemplo: `Identidade`, `Progresso & Economia` (fusão de
2+4+6), `Social & Notificações` (fusão de 3+5), `Frontend`, mantendo
`Plataforma/DevOps` como responsabilidade compartilhada por todos (cada
squad cuida do seu próprio pipeline, coordenados por um "DevOps champion"
rotativo entre squads a cada sprint).
