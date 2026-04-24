# Gemini Tutor - Plano de Execucao para o Hackathon

Este documento transforma a estrategia de [GEMINI_TUTOR_HACKATHON_WINNING_PLAN.md](./GEMINI_TUTOR_HACKATHON_WINNING_PLAN.md) num plano operacional curto e executavel.

## Objetivo

Entregar uma versao do `Gemini Tutor` que demonstre:

- Gemini como motor de inteligencia;
- Arc como camada de settlement;
- USDC como unidade de valor;
- Circle Nanopayments como cobranca por acao;
- 50+ transacoes onchain numa demo real;
- margem economica clara contra gas tradicional.

## Produto final

Nome recomendado:

`Gemini Tutor Economy`

Tese:

`Aprender passa a ser pay-per-action: o aluno paga apenas pelas explicacoes, verificacoes e visuais que usa, com settlement instantaneo em USDC sobre Arc.`

## Track

Escolha principal:

- `Usage-Based Compute Billing`

Reforco narrativo:

- `Agent-to-Agent Payment Loop`

## Arquitetura minima

### Frontend

- chat texto;
- upload de imagem;
- modo voz;
- painel de custos por acao;
- feed de transacoes;
- saldo USDC;
- historico da sessao.

### Backend

- orquestrador de pedidos;
- chamadas Gemini para raciocinio e multimodalidade;
- integracao Circle para wallets e pagamentos;
- registo de eventos economicos;
- exposicao de transacoes por sessao.

### Camada economica

- wallet do utilizador;
- wallet dos agentes;
- pricing por acao;
- micropagamentos em USDC;
- settlement em Arc;
- explorer links por transacao.

## Backlog priorizado

### P0 - Obrigatorio para a demo

1. Mostrar preco por acao antes da execucao.
2. Cobrar em USDC por pelo menos 3 tipos de acao.
3. Registar e exibir transacoes onchain.
4. Gerar 50+ transacoes numa sessao demonstravel.
5. Mostrar uma transacao no Circle Developer Console.
6. Verificar a mesma transacao no Arc Block Explorer.
7. Explicar porque gas tradicional destruiria a margem.

### P1 - Alto valor

1. Separar 3 a 5 agentes com papeis claros.
2. Criar dashboard economico com custo total, receita e contagem.
3. Mostrar saldo USDC do utilizador.
4. Mostrar historico de progresso por sessao.
5. Permitir analise de imagem de exercicio.

### P2 - Se houver tempo

1. Geracao de diagramas educativos.
2. Loop de pagamento entre agentes.
3. API externa paga por chamada.
4. Indicadores de latencia e settlement.

## Fluxo da demo

### Cena 1 - Problema

Mostrar que subscricao mensal e má para uso ocasional e que gas tradicional nao permite micropagamentos frequentes.

### Cena 2 - Entrada multimodal

O aluno envia uma foto ou pergunta.

### Cena 3 - Preco visivel

O sistema mostra:

- tipo de acao;
- custo em USDC;
- saldo restante;
- previsao de impacto na sessao.

### Cena 4 - Orquestracao

O pedido passa pelo orchestrator e aciona:

- explanation agent;
- verification agent;
- visual agent;
- progress agent.

### Cena 5 - Settlement

Cada etapa gera micropagamento e aparece no feed.

### Cena 6 - Prova onchain

Mostrar:

- transacao no Circle Developer Console;
- hash no Arc Explorer;
- contador de 50+ transacoes.

### Cena 7 - Margem

Fechar com comparacao simples:

- preco por acao abaixo de $0.01;
- gas tradicional maior que o valor da acao;
- Arc + Nanopayments tornam o modelo viavel.

## Tabela de pricing sugerida

- `Explain concept`: `$0.001`
- `Check answer`: `$0.002`
- `Give hint`: `$0.001`
- `Analyze image`: `$0.004`
- `Generate visual`: `$0.005`
- `Multi-agent review`: `$0.006`

Regra:

- cada acao tem de ficar abaixo de `$0.01`.

## Como gerar 50+ transacoes sem parecer artificial

O truque nao e inflar a demo. E decompor a sessao em eventos naturais:

- 8 pedidos curtos de explicacao;
- 8 validacoes de resposta;
- 8 pistas progressivas;
- 8 eventos de memoria/progresso;
- 8 chamadas entre agentes;
- 10 eventos de visualizacao ou verificacao.

Total: 50+ eventos reais e legiveis.

## Estrutura tecnica recomendada

### Gemini

- usar Gemini para interpretar contexto, responder e decidir o proximo passo;
- usar multimodalidade para imagem de exercicios;
- usar function calling ou orchestration interna para chamar metodos de pagamento e registo.

### Circle

- usar Circle Wallets como base de wallets;
- usar Nanopayments para per-action pricing;
- usar USDC como ativo de settlement;
- usar Arc como rede de liquidação;
- mostrar sempre a prova da transacao.

### x402

- opcionalmente usar x402 para demonstrar pagamento web-native por request;
- útil se quiserem mostrar monetizacao de API por chamada.

## Estrutura de codigo recomendada

### Frontend

- `src/App.tsx`
  - UI principal do tutor;
  - estado de sessao;
  - painel economico;
  - feed de transacoes.

### Backend

- `server/index.ts`
  - rotas de chat e analise;
  - orquestracao de agentes;
  - integracao com Gemini;
  - integracao de settlement;
  - telemetria de transacoes.

### Persistencia

- guardar:
  - mensagens;
  - custos por acao;
  - transacoes;
  - saldo;
  - eventos por sessao.

## Pitch de 3 minutos

1. Problema: educacao digital costuma depender de subscricoes ou custo fixo.
2. Solucao: tutor pay-per-action com Gemini.
3. Economia: cada interacao relevante custa centavos ou frações de centavo em USDC.
4. Infraestrutura: Arc para settlement, Circle Nanopayments para microtransacoes.
5. Prova: 50+ transacoes onchain e transacao validada no explorer.
6. Margem: o modelo funciona porque o gas tradicional tornaria o pricing inviavel.

## Texto-base para submissao

`Gemini Tutor Economy` is an agentic learning platform where students pay only for the educational actions they actually use. Gemini powers multimodal reasoning, while Circle Nanopayments and Arc settle sub-cent USDC transactions for explanations, hints, checks, and visuals. The result is a real pay-per-learning system with 50+ onchain transactions, transparent pricing, and a clear economic case that would fail under traditional gas costs.

## Campo de feedback Circle

Responder com detalhe:

- produtos usados;
- porque foram escolhidos;
- o que funcionou bem;
- o que foi dificil;
- o que faltou;
- como melhorar DX, docs, exemplos e debugging.

## Checklist final antes de submeter

- o app mostra precos por acao?
- ha settlement em Arc?
- ha USDC no fluxo principal?
- ha Nanopayments no fluxo principal?
- ha 50+ transacoes?
- ha prova no Circle Console?
- ha prova no Arc Explorer?
- ha margem explicada?
- ha video curto e claro?
- ha repo publico limpo?

## Proximo passo

Se quiseres, eu posso agora fazer uma destas tres coisas:

1. escrever o README novo para a versao hackathon;
2. desenhar a arquitetura tecnica detalhada por ficheiro;
3. preparar o guiao do video e dos slides.
