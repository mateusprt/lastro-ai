# Lastro

Editor de arquitetura e motor de simulação de capacidade. Detalhes de produto e arquitetura no TDD do projeto.

## Requisitos

- Node.js 22 ou superior

## Comandos

```bash
npm install
npm run dev            # API (porta 3333) + frontend (http://localhost:5173)
npm run typecheck      # TypeScript estrito, servidor e web
npm run lint           # ESLint, inclusive a regra que impede o frontend de importar o motor
npm test               # motor e API (Vitest + fast-check)
npm run build:web      # build de produção do frontend em dist/web
```

No desenvolvimento, o Vite encaminha `/api` para a API. Em produção, o Caddy serve `dist/web` e encaminha `/api` para a API, no mesmo domínio.

## Estrutura

```
src/
  shared/
    simulation.ts            contrato de entrada e saída da simulação (só tipos)
  server/
    engine/                  motor de simulação (usado somente pela API)
    app.ts, index.ts         Express 5
    routes/                  /api/health, /api/simulations, /api/waitlist (provisório)
    controllers/  services/  middlewares/  validation/  http/
  web/                       frontend React + Vite
    index.html, main.tsx, App.tsx
    http/                    cliente da API (cookies httpOnly, renovação em 401)
    store/                   estado do editor (zustand, desfazer/refazer) e da simulação
    domain/                  catálogo de componentes, modelos, formatação, diagnóstico
    hooks/                   simulação automática, rascunho local, carregar modelo
    components/
      canvas/                React Flow: nós, ligações, paleta
      panels/                simulação e propriedades (abas)
      results/               tabela de componentes e curva de resposta
    styles/app.css
```

## Frontend

- **Editor**: React Flow (`@xyflow/react`). Arraste da paleta ou clique para adicionar. Para ligar, puxe da bolinha à direita de um componente até a da esquerda de outro. Ligações que criariam ciclo, duplicadas ou para o próprio componente são recusadas.
- **Simulação automática**: cada edição chama `POST /api/simulations` com debounce de 300 ms e cancela a requisição anterior. Mover nós não dispara simulação. O último resultado continua visível, esmaecido, enquanto o novo é calculado ou se der erro.
- **Feedback no diagrama**: cada nó mostra a utilização num medidor com a linha de carga (o limite seguro) e o status com ícone e texto. As ligações mostram a vazão.
- **Painéis**: diagnóstico em linguagem simples sobre o canvas; abas "Simulação" (tráfego, limite seguro, capacidade, tempo de resposta, gargalo) e "Propriedades" (alternam conforme a seleção); tabela de componentes e curva de resposta com crosshair e visão em tabela.
- **Plano Pro**: o custo aparece bloqueado com o selo "Pro"; "Cenários" e "Plano Pro em breve" abrem o diálogo da lista de espera, que registra o recurso que motivou o clique.
- **Atalhos**: Ctrl/⌘+Z desfaz, Ctrl/⌘+Shift+Z ou Ctrl+Y refaz, Delete exclui a seleção, Esc limpa a seleção.
- **Rascunho**: provisoriamente guardado no `localStorage` até existir o salvamento na API.

O frontend nunca importa `src/server`: a regra `no-restricted-imports` do ESLint bloqueia, e o build é conferido para não conter o motor.

## Motor

| Etapa | Fórmula |
|---|---|
| Visitas | `visitas[destino] += visitas[origem] × chamadas por requisição`, em ordem topológica. Ligações assíncronas geram carga, mas nada abaixo delas entra nas visitas síncronas. |
| Vazão | `X = λ × visitas` |
| Utilização | `U = X × S / c` |
| Tempo de resposta por visita | `R = S + C(c, a) × S / (c − a)`, com `a = X × S` e `C` = Erlang C |
| Ponta a ponta | `Σ visitas síncronas × R` |
| Segundo plano | Para cada ligação assíncrona disparada no caminho síncrono, o tempo do job no destino (com jobs aninhados). Vale o ramo mais lento. |
| Capacidade máxima | `min(c / (visitas × S))` entre os componentes com fila |
| Capacidade segura | capacidade máxima × limite seguro |
| Instâncias necessárias | `max(c, ⌈a / limite seguro⌉)` |
| Status | crítico a partir do limite seguro; atenção a partir de 75% dele |

Serviços externos são latência fixa: não têm fila, não entram no gargalo nem nas capacidades. Tempos e capacidades `null` significam "ilimitado". Erlang C é calculado pela recorrência de Erlang B, estável com milhares de instâncias. Um diagrama de 50 componentes roda em cerca de 2 ms (p95).

## API (até agora)

| Rota | Descrição |
|---|---|
| `GET /api/health` | Status da API |
| `POST /api/simulations` | Valida com Joi (400 com os campos) e roda o motor (422 com os problemas do diagrama) |
| `POST /api/waitlist/pro` | **Provisório**, em memória até existirem banco e autenticação |

Ainda faltam autenticação, limites de plano no backend, `helmet`, limite de requisições, persistência no Postgres e a remoção dos campos de custo da resposta para o plano gratuito.
