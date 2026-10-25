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

## Ideias para depois

- Teste de nivelamento inicial.
- Lembrete diário (notificação) — no iPhone só funciona com o app instalado.
- Sincronização entre aparelhos (hoje: backup JSON).
