# Fluent — inglês sob medida (PWA de uso pessoal)

Publicado em https://caiozuniga.github.io/ingles-app/ (deploy automático a cada push na `main`).

## Decisões (enquete de 25/10/2026)

- **Motor:** banco de conteúdo offline + Claude API com a chave do próprio usuário (fica só no aparelho, fora do backup).
  Modelo padrão Claude Opus 5.5; Sonnet 5.5 e Haiku 5.5 selecionáveis em Ajustes para baratear.
- **Plataforma:** PWA (React + Vite + TS + Tailwind v4 + Dexie), instalável no Android e no iPhone pela tela inicial.
- **Demandas:** trabalho/negócios, viagem/dia a dia, prova (TOEFL/IELTS/Cambridge) e conteúdo — escolhidas no perfil.
- **Speaking:** reconhecimento de voz do aparelho (Web Speech API) + avaliação pela IA. Onde não houver suporte
  (alguns modos do iPhone), o campo de texto aceita o ditado do teclado.

## Como personaliza

- Perfil: nível, demandas, prova, temas e um texto livre de contexto que vai em todo prompt da IA.
- Nível estimado por habilidade (`src/engine/progress.ts`): cada atividade gera uma nota na escala CEFR
  conforme o nível do conteúdo e o acerto; a estimativa anda em direção a ela.
- Pontos fracos: etiquetas de erro (exercícios, correções de writing/speaking, roleplay) com peso por recência.
  Viram foco das aulas da IA e aparecem na Home.
- Plano do dia: revisão de palavras primeiro; depois as habilidades mais fracas, menos praticadas e ligadas às demandas, até caber nos minutos diários.

## Conteúdo offline (`src/data/`)

32 tópicos de gramática (256 exercícios), 480 palavras, 24 listenings com perguntas e ditado, 90 frases de shadowing,
30 perguntas de speaking, 30 propostas de writing e 18 roleplays.

## Visual (enquete de 25/10/2026)

Direção "editorial refinado": títulos em Fraunces, ícones de traço próprios (`src/components/icons.tsx`), cards com sombra suave,
anel de progresso na Home. Tema Automático/Claro/Escuro em Ajustes (`src/state/theme.ts`): escuro grafite + âmbar,
claro papel creme + tinta azul-marinho. Tokens em `src/index.css`.

## Funções adicionadas na mesma rodada

- **Plano concreto + sessão guiada:** cada item do plano aponta para um exercício específico (`src/engine/picker.ts`);
  "Começar sessão guiada" encadeia os itens com uma barra no topo e mostra um resumo no fim (`src/state/session.ts`).
- **Caderno de erros com repetição espaçada:** caixas de Leitner (1, 3, 7, 14, 30 dias) em `/erros/revisar`.
- **Teste de nivelamento:** 25 perguntas (vocabulário, gramática, listening; 2 por nível A1–C1) definem o ponto de partida de cada habilidade.
- **Custo da IA:** cada chamada registra tokens e custo estimado (tabela de preços em `src/ai/client.ts`); total do mês em Ajustes.
- **Lembrete diário:** evento recorrente com alarme no calendário (.ics para iPhone/Outlook, link do Google Agenda),
  porque um PWA sem servidor não agenda notificações com o app fechado.

## Ideias para depois

- Sincronização entre aparelhos (hoje: backup JSON).
- Reading com toque-para-traduzir.
