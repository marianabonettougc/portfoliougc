# O documento para a marca

Roteiro aprovado vira documento formatado. O padrão é fixo e vale para qualquer cliente, independente das cores da marca.

## Paleta

- Azul-marinho `172B58`: título, faixas, rótulos, cabeçalho da tabela
- Ciano `2FB7D1`: réguas sob o título e sob títulos de seção
- Cinza-azulado `EDF0F5`: fundo das linhas de rótulo de cena
- Cinza claro `F2F4F8`: fundo do subcabeçalho
- Cinza `D8DDE6`: bordas
- Cinza `6C7280`: linha de ângulo em itálico
- Cinza `8A8A8A`: coluna de imagem, mais claro de propósito
- Preto suave `222222`: coluna de áudio
- Azul-claro `E7EEF6`: destaque para variações e opções a gravar

## Medidas

Página A4 retrato, 11906 x 16838 dxa. Margens de 1020 a 1080 no topo, 1000 a 1080 nas laterais, 720 na base. Largura de conteúdo 9746. Fonte Arial.

Duas colunas: 4873 cada.
Três colunas: 3550, 3550 e 2646.

## Estrutura, de cima para baixo

1. Logo da marca, ou o nome como marca-texto quando não houver arquivo.
2. Título grande em azul-marinho, no formato "Marca · Produto | Formato".
3. Régua ciano.
4. Faixa azul-marinho centralizada, texto branco, com o tipo de documento.
5. Linha de ângulo em itálico cinza: conceito, duração e restrição principal.
6. Tabela de identificação 1: creator e marca.
7. Tabela de identificação 2: campanha, formato e postagem, com espaçamento curto entre as duas.
8. Grid de áudio e imagem, com cabeçalho azul e subcabeçalho cinza itálico.
9. Por cena: uma faixa de rótulo com nome e timecode, e abaixo a linha de conteúdo.
10. Quando há mais de um roteiro, faixa de opção por roteiro, com quebra de página a partir da segunda.
11. Seções finais com título azul e régua ciano.

## Os três formatos de grid

**Duas colunas: áudio e imagem.** O padrão.

**Três colunas: áudio em português, áudio em inglês e cenas.** Para cliente estrangeiro. A coluna em inglês é tradução para revisão, não o que será falado.

**Decupagem por frase: número, fala e take.** Para vídeo com muitos planos curtos, inserts ou animação. Cada frase recebe o seu take.

## Regras de escrita dentro do documento

- Falas entre aspas.
- Falas obrigatórias da marca em negrito azul-marinho, para não serem alteradas por engano.
- Direções de imagem em primeira pessoa, como se quem grava tivesse anotado: "aponto pros meus poros", não "você apontando".
- Campos que dependem de informação externa entre parênteses: "(produto)", "(proporção do rótulo)".
- Sem travessão em lugar nenhum.
- Marcar em azul-claro as cenas que devem ser gravadas em mais de uma versão.

## As seções finais

Separe em blocos com título próprio:

- **Obrigatórios**, em formato de checklist, para conferir um a um na gravação.
- **Proibido**, com as restrições do briefing.
- **Observações de captação**, com luz, cenário, áudio e o que a edição precisa saber.
- **Pontos a alinhar**, com tudo que depende de resposta da marca.

Esse último bloco é o que mais evita retrabalho. Registre ali toda decisão que você tomou por falta de informação, toda contradição encontrada no briefing e todo campo em aberto.

## Entrega

Gere o arquivo em docx e converta em pdf.

O pdf vai para a marca, porque abre igual em qualquer dispositivo.
O docx serve para editar e para arrastar ao Google Drive e abrir como Documentos Google, o que preserva a formatação.

Criar o documento direto no Drive por integração traz só texto puro, sem tabela nem cor.

## Passo a passo técnico

Para quem gera o documento por código:

1. Escrever o build em docx-js.
2. Rodar o build.
3. Validar o arquivo.
4. Converter em pdf.
5. Renderizar as páginas em imagem e conferir de verdade, olhando.
6. Copiar para a pasta de saída e entregar os dois arquivos.

O passo de conferir olhando é o que pega erro de layout, texto cortado e inconsistência entre o cabeçalho e o conteúdo.
