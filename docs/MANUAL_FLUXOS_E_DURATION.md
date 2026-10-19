# 📘 Manual Institucional: Fluxo de Pagamentos, Agenda e Calculadora de Duration (DU/252)

> **Documento Mestre Unificado de Engenharia Financeira e Arquitetura de Dados**  
> **Sistemas Abrangidos:** FixData / Meu Crédito Privado (`meucreditoprivado.netlify.app`), Apache Airflow 3.x, SQLite `credito_privado.db` e Frontend React/Vite.  
> **Público-Alvo:** Desenvolvedores, Engenheiros de Dados, Analistas Quantitativos e Agentes Autônomos de IA (Antigravity).

---

## 📑 Sumário Executivo

Este manual consolida a especificação técnica, a fundamentação matemática e o runbook operacional de dois pilares centrais da plataforma FixData:
1. **Fluxo & Agenda Multitemporal de Pagamentos:** Ingestão multi-fonte, normalização taxonômica, conciliação de Data Base vs. Liquidação Útil, deduplicação temporal hierárquica e garantia de cobertura para 100% dos ativos vivos.
2. **Calculadora de Duration & Fluxos Futuros a Valor Presente:** Metodologia matemática de apuração de Duration de Macaulay e Modified Duration na convenção brasileira **Dias Úteis / 252 (`DU/252`)**, distinção por classe de indexador (IPCA+, Pós-fixados DI+/DI% via *Spread Duration*, e Pré-fixados), projeção e desconto de curvas no tempo e dinâmica de *Pull-to-Par*.

---

# PARTE 1: Fluxo de Pagamentos e Agenda Multitemporal

## 1.1 Topologia de Ingestão Multi-Fonte

A integridade da agenda de pagamentos exige a captura de fontes primárias e secundárias, pois nenhum provedor público individual cobre com exatidão a totalidade do universo de crédito privado brasileiro (Debêntures, CRIs e CRAs). O pipeline combina cinco camadas complementares:

```mermaid
flowchart TD
    A1["1. Agente Cadastral (Gemini NLP)<br/>Escrituras e Termos de Securitização"] --> B["Camada de Normalização & Sanity Check"]
    A2["2. ANBIMA Data (web-bff Crawler)<br/>Agenda de Eventos e PUs Liquidados"] --> B
    A3["3. ANBIMA Características<br/>Próximo Evento Oficial Confirmado"] --> B
    A4["4. Securitizadoras & Trustees<br/>Informes Periódicos de Lastro"] --> B
    A5["5. Engine Paramétrico Sintético<br/>Projeção Contratual Recursiva"] --> B
    B --> C["Deduplicação Hierárquica em 2 Passos"]
    C --> D1["tb_fluxo_pagamentos (SQLite)"]
    C --> D2["tb_fluxos_futuros_consolidado (SQLite)"]
    D2 --> E1["cashflow_wall.json"]
    D1 --> E2["agenda_consolidada.json"]
    D1 --> E3["Telegram Radar Matinal"]
```

### Detalhamento das 5 Fontes:

1. **Agente Cadastral (`tb_agente_fluxo_pagamentos`):**
   - **Origem:** Extração primária via visão computacional e NLP (Gemini) sobre as Escrituras Públicas de Emissão de Debêntures e Termos de Securitização de CRIs/CRAs depositados na CVM e B3.
   - **Papel:** Fonte canônica para cronogramas de amortizações parciais programadas e regras originais de repactuação.
2. **ANBIMA Data Crawler (`crawl_anbima_agenda_direct`):**
   - **Origem:** Interceptação direta dos endpoints JSON da API `web-bff` do portal ANBIMA Data (`https://data.anbima.com.br/{debentures|certificado-de-recebiveis}/{ticker}/agenda-de-eventos`) via Playwright headless com bloqueio de mídia/fontes pesadas.
   - **Papel:** Fonte de máxima autoridade para eventos já liquidados ou provisionados, com valor unitário (PU) oficial pago e datas exatas de liquidação no Sistema de Pagamentos Brasileiro (SPB).
3. **ANBIMA Características Oficiais (`carrega_eventos_anbima_proximo_evento`):**
   - **Origem:** Tabelas `anbima_debentures_caracteristicas` e `anbima_cricra_caracteristicas`.
   - **Papel:** Captura imediata do próximo evento (`data_proximo_evento >= date('now')`) homologado pela ANBIMA para todos os papéis sob monitoramento diário.
4. **Securitizadoras & Trustees (`cp_securitizadoras`):**
   - **Origem:** Raspagem estruturada de informes mensais e atas de securitizadoras (Opea, Virgo, Cibrasec, True, RB Capital, etc.).
   - **Papel:** Identificação de amortizações extraordinárias de CRIs/CRAs decorrentes de liquidação de lastros imobiliários ou agrícolas.
5. **Engine Paramétrico Sintético (`gera_cronograma_contratual_ativo`):**
   - **Origem:** Algoritmo recursivo que processa todos os ativos vivos de `tb_cadastro_ativos` que não possuam eventos mapeados nas fontes anteriores.
   - **Papel:** Garantir que 100% dos ativos vivos possuam datas de cupons e vencimento final preenchidos na grade, eliminando qualquer ponto cego no radar.

---

## 1.2 O Problema Crítico: Data Base Contratual vs. Data de Liquidação Útil

### Diagnóstico do Caso Real (Exemplo `VALED1`):
Ao consultar o papel `VALED1` (ou debêntures corporativas correlatas), observava-se anteriormente que a plataforma apresentava pagamentos registrados no dia 15 e no dia 16 do mesmo mês.
- **Causa Raiz:** A escritura de emissão prevê o pagamento no **dia 15** de cada período (Data Base Contratual). Contudo, nos anos em que o dia 15 incide em sábado, domingo ou feriado bancário nacional (conforme Lei nº 7.089/1983 e Resoluções CMN), o pagamento é automaticamente postergado para o **1º dia útil subsequente** (Data de Liquidação Financeira, ex: dia 16 ou 17).
- Algumas fontes públicas (como sistemas cadastrais) publicavam a data base teórica (`2026-04-15`), enquanto a ANBIMA publicava a data de liquidação efetiva (`2026-04-16`). Sem conciliação, o pipeline gerava **dois registros distintos**, duplicando indevidamente o volume financeiro e gerando alarmes falsos de inadimplência ou duplo pagamento.

### Solução Arquitetural Implementada:
1. **Campos Distintos na Estrutura de Dados:**
   - `data_evento`: Representa a data base de referência da obrigação.
   - `data_liquidacao`: Representa o dia útil em que os recursos são efetivamente creditados na conta de custódia do investidor via Selic/B3.
2. **Deduplicação Hierárquica em Dois Estágios:**
   - **Estágio 1 (Deduplicação Exata):** Elimina registros com a mesma chave composta `(ticker, data_evento, tipo_evento)`.
   - **Estágio 2 (Janela Temporal de Proximidade $\le 7$ dias):** Para o mesmo ativo e mesmo tipo de evento, se dois registros existirem em uma janela de até 7 dias corridos, o pipeline preserva o evento da fonte de maior prioridade hierárquica e unifica a data base e a liquidação em um único evento:
     $$\text{Hierarquia: } \text{ANBIMA Oficial (Prio 1)} > \text{Escritura (Prio 2)} > \text{Securitizadora (Prio 3)} > \text{Paramétrico (Prio 4)}$$

---

## 1.3 Taxonomia e Normalização de Eventos

Strings heterogêneas provenientes dos diversos agentes do mercado são convertidas em 5 tipos canônicos padronizados:

| Tipo Canônico | Termos Originais Mapeados | Descrição Contábil / Financeira |
| :--- | :--- | :--- |
| **`Pagamento de Juros`** | `JUROS`, `REMUNERAÇÃO`, `CUPOM`, `RENDIMENTO`, `PARCELA DE JUROS` | Crédito de rendimentos periódicos incidentes sobre o saldo devedor. |
| **`Amortização`** | `AMORTIZAÇÃO PARCIAL`, `AMORTIZAÇÃO`, `AMORT`, `DEVOLUÇÃO DE CAPITAL` | Devolução parcial do valor nominal do principal. |
| **`Vencimento`** | `RESGATE`, `VENCIMENTO FINAL`, `RESGATE ANTECIPADO`, `AMORTIZAÇÃO 100%` | Liquidação integral do saldo remanescente do papel. |
| **`Repactuação`** | `REPACTUAÇÃO`, `REPACTUA`, `TAXA REPACTUADA` | Data formal de repactuação de condições de remuneração. |
| **`Prêmio`** | `PRÊMIO`, `BONIFICAÇÃO`, `PREMIO DE RESGATE` | Remuneração acessória contratual. |

---

## 1.4 Estrutura de Dados e Persistência no SQLite

As tabelas de agenda residem no banco de produção `/home/home/airflow/src/data/credito_privado.db`:

### Tabela `tb_fluxo_pagamentos` (Eventos Pontuais):
```sql
CREATE TABLE IF NOT EXISTS tb_fluxo_pagamentos (
    ticker TEXT,
    isin TEXT,
    data_evento TEXT,         -- YYYY-MM-DD (Data Base Contratual)
    data_liquidacao TEXT,     -- YYYY-MM-DD (Data Efetiva Útil de Liquidação)
    tipo_evento TEXT,         -- Pagamento de Juros, Amortização, Vencimento
    taxa REAL,                -- Taxa aplicada no evento (se informada)
    valor_real REAL,          -- PU pago liquidado (R$)
    valor_projetado REAL,     -- PU previsto/estimado (R$)
    percentual_amortizacao REAL, -- % amortizado sobre o PU base
    status TEXT,              -- 'Liquidado' ou 'Previsto'
    flag_status TEXT,         -- 'Total' ou 'Parcial'
    fonte TEXT,               -- 'ANBIMA Oficial', 'Agente Cadastral - Escritura', etc.
    anomesdia INTEGER,        -- Data de ingestão YYYYMMDD
    atualizado_em TEXT        -- Timestamp da última atualização
);
```

### Tabela `tb_fluxos_futuros_consolidado` (Grade Temporal Consolidada):
Armazena a projeção de mais de 111.000 parcelas futuras de 100% dos ativos vivos:
- Contém colunas de particionamento temporal: `ano`, `mes`, `ano_mes`, `bucket_ano` (`2026`, `2027`, ..., `2046+`).
- Volumes financeiros calculados em Reais (`volume_financeiro`) e em Bilhões (`volume_financeiro_bi`).
- Persistência atômica via Staging Table com substituição transacional segura (`DELETE FROM target; INSERT INTO target SELECT ...; DROP TABLE staging;`), prevenindo bloqueios ou corrupção de views dependentes.

---

# PARTE 2: Calculadora de Duration e Fluxo Futuro a Valor Presente

## 2.1 Convenção de Calendário Brasileira (Dias Úteis / 252)

Diferente dos mercados internacionais que adotam convenções de contagem contínua (ex: *Actual/Actual* nos US Treasuries ou *30/360* no mercado europeu), o mercado financeiro de renda fixa e crédito privado brasileiro opera sob a convenção estrita de **Dias Úteis sobre base anual de 252 dias úteis (`DU/252`)**, conforme padronização da ANBIMA e B3.

### Regras de Contagem de Dias Úteis:
1. Excluem-se todos os sábados e domingos.
2. Excluem-se todos os feriados nacionais civis e religiosos decretados pela legislação brasileira.
3. **Algoritmo Astronômico de Meeus/Jones/Butcher para Feriados Móveis:**  
   O módulo `cp_anbima/calculadora_duration.py` calcula de forma analítica e perpétua (2015 a 2060) as datas dos feriados móveis que dependem do equinócio e ciclo lunar da Páscoa:
   - **Segunda-feira de Carnaval:** Páscoa $- 48$ dias corridos.
   - **Terça-feira de Carnaval:** Páscoa $- 47$ dias corridos.
   - **Sexta-feira da Paixão:** Páscoa $- 2$ dias corridos.
   - **Corpus Christi:** Páscoa $+ 60$ dias corridos.
4. **Feriados Fixos Federais:**
   - $01/01$ (Confraternização Universal), $21/04$ (Tiradentes), $01/05$ (Dia do Trabalho), $07/09$ (Independência), $12/10$ (N. Sra. Aparecida), $02/11$ (Finados), $15/11$ (Proclamação da República), $20/11$ (Dia da Consciência Negra - Lei nº 14.759/2023) e $25/12$ (Natal).

A conversão do prazo em dias úteis ($DU$) para o prazo fracionário em anos úteis ($t_{\text{anos}}$) é dada estritamente por:
$$t_{\text{anos}} = \frac{DU}{252}$$

---

## 2.2 Fórmulas Matemáticas de Duration e Sensibilidade

### 1. Duration de Macaulay ($D_{\text{Mac}}$)
A Duration de Macaulay representa a média ponderada do tempo até o recebimento de todos os fluxos de caixa futuros do ativo (cupons e amortizações de principal), onde os pesos equivalem ao valor presente de cada fluxo relativo ao preço total do título:

$$PV(CF_t) = \frac{CF_t}{(1 + y)^{\frac{DU_t}{252}}}$$

$$D_{\text{Mac}} = \frac{\sum_{t=1}^N \left(\frac{DU_t}{252}\right) \cdot PV(CF_t)}{\sum_{t=1}^N PV(CF_t)}$$

Onde:
- $CF_t$: Fluxo de caixa bruto no vértice $t$ (Cupom de Juros e/ou Parcela de Amortização de Principal).
- $DU_t$: Número exato de dias úteis entre a data-base de apuração e a data de liquidação do fluxo $t$.
- $y$: Taxa de juros anual de desconto do título na convenção $DU/252$ expressa em formato decimal (ex: $6{,}50\% \text{ a.a.} \rightarrow 0{,}065$).
- $\sum_{t=1}^N PV(CF_t) = PU$: Preço Unitário Teórico do ativo a valor presente.

### 2. Duration Modificada ($D_{\text{mod}}$)
A Duration Modificada mede a elasticidade percentual direta do preço do ativo em resposta a uma variação marginal na taxa de juros anual:

$$D_{\text{mod}} = \frac{D_{\text{Mac}}}{1 + y}$$

### 3. Sensibilidade de Preço e Choques de Curva ($\Delta PU$)
Para uma variação na taxa de juros de mercado expressa em pontos-base ($\Delta y_{\text{bps}}$), a variação percentual aproximada no Preço Unitário ($PU$) é dada pela aproximação de primeira ordem de Taylor:

$$\frac{\Delta PU}{PU} \approx - D_{\text{mod}} \cdot \Delta y = - D_{\text{mod}} \cdot \left(\frac{\Delta y_{\text{bps}}}{10.000}\right)$$

> **Exemplo Numérico:**  
> Título com Duration de Macaulay $= 3{,}20$ anos, negociado a uma taxa de $6{,}00\%$ a.a. ($y = 0{,}06$):
> $$D_{\text{mod}} = \frac{3{,}20}{1 + 0{,}06} = 3{,}0189 \text{ anos}$$
> Se a curva de juros abrir $+100 \text{ bps}$ ($+1{,}00\%$):
> $$\frac{\Delta PU}{PU} \approx -3{,}0189 \times 0{,}01 = -3{,}02\%$$

---

## 2.3 Metodologia por Classe de Indexador

O motor implementa o tratamento institucional específico para as três famílias de indexadores do mercado brasileiro:

### 1. Títulos Indexados à Inflação (IPCA+ / NTN-B Like)
- **Comportamento dos Cupons:** Cupons semestrais exponenciais calculados sobre a base de 126 dias úteis:
  $$c_{\text{sem}} = (1 + y_{\text{cupom}})^{\frac{126}{252}} - 1 = \sqrt{1 + y_{\text{cupom}}} - 1$$
- **Incidência sobre o Saldo Devedor:** Em caso de amortização periódica constante, o cupom do período $t$ incide estritamente sobre o saldo devedor remanescente após as amortizações dos períodos anteriores:
  $$\text{Cupom}_t = \text{Saldo Devedor}_{t-1} \times c_{\text{sem}}$$
- **Desconto a Valor Presente:** Todos os fluxos nominais projetados são trazidos a valor presente pela taxa real de desconto $y$.

### 2. Títulos Pós-Fixados (DI+ e DI% / CDI)
- **Natureza do Risco de Taxa:** Em títulos pós-fixados, o cupom repactua diariamente conforme a oscilação do CDI. Consequentemente, a duration tradicional em relação à taxa básica Selic/DI é praticamente nula (equivale a $1 \text{ DU}$).
- **Conceito de Spread Duration:** A métrica institucional relevante para o investidor é a **Spread Duration** (sensibilidade ao spread de crédito sobre o CDI).
- **Cálculo da Spread Duration:**
  - Para títulos com **amortização Bullet** (100% no vencimento final):
    $$\text{Spread Duration} = \frac{DU_{\text{vencimento}}}{252}$$
  - Para títulos com **amortizações periódicas programadas** (ex: parcelas anuais ou semestrais): A Spread Duration equivale rigorosamente ao **Prazo Médio Ponderado (PMP)** do retorno do principal em anos úteis:
    $$\text{Spread Duration} = \frac{\sum_{i=1}^M \left(\frac{DU_i}{252}\right) \cdot \text{Amortização}_i}{\sum_{i=1}^M \text{Amortização}_i}$$

### 3. Títulos Pré-Fixados
- Apuração clássica onde os cupons periódicos e o principal de resgate são prefixados em reais nominais e descontados pela taxa pré anual $y$ na convenção $DU/252$.

---

## 2.4 Projeção de Curvas no Tempo e Dinâmica de Pull-to-Par

### 1. Interpolação na Curva Soberana de Referência (ETTJ)
Para ativos IPCA+, o sistema utiliza a Estrutura a Termo das Taxas de Juros Soberana (Curva de NTN-B da ANBIMA/B3), interpolando a taxa livre de risco nos vértices específicos da duration de cada ativo.
- O **Spread de Crédito Real (Spread Over)** é a diferença aritmética entre a taxa indicativa de negociação do ativo e a taxa da NTN-B sintética de mesma duration:
  $$\text{Spread Over} = y_{\text{ativo}} - y_{\text{NTN-B}(\text{duration})}$$

### 2. Amortecimento do Risco e Efeito Pull-to-Par
À medida que o tempo transcorre ($t \rightarrow T$), o prazo remanescente do ativo diminui, reduzindo linearmente a sua Duration:
$$D_{\text{rem}}(t) \approx D_0 \times \left(\frac{T - t}{T}\right)$$
Essa contração da duration amortece progressivamente a sensibilidade a choques de mercado, forçando o Preço Unitário de mercado a convergir matematicamente para o seu Preço Par no vencimento final (*Efeito Pull-to-Par*).

### 3. Estratégias de Reinvestimento de Fluxos Intermediários:
A calculadora do simulador (`src/utils/calculatorMath.ts`) implementa três hipóteses de reinvestimento para apuração do Saldo Futuro Final acumulado:
- **Reinvestimento à Taxa do Ativo:** Supõe que cada cupom é imediatamente reaplicado na mesma rentabilidade contratada.
- **Reinvestimento ao CDI:** Supõe que os proventos são depositados em um fundo soberano DI pós-fixado com liquidez diária.
- **Sem Reinvestimento (Renda Passiva):** Os cupons são consumidos pelo investidor como fluxo de caixa livre periódico.

---

# PARTE 3: Guia de Operação e Manutenção para IAs e Desenvolvedores

## 3.1 Mapa de Módulos e Responsabilidades

| Caminho do Arquivo | Módulo / Função | Responsabilidade Técnica |
| :--- | :--- | :--- |
| `src/cp_anbima/calculadora_duration.py` | `calcular_duration_ativo` / `calcular_duration_fluxo_exato` | Motor matemático institucional de contagem de feriados móveis, dias úteis e duration `DU/252`. |
| `src/cp_fluxo_pagamentos/main.py` | `captura_e_consolida_fluxos` | Pipeline de ingestão multi-fonte, normalização de strings e deduplicação temporal em 2 passos. |
| `src/cp_fluxos_futuros/main.py` | `processa_fluxos_futuros_ativos` | Projeção em escala de 100% dos fluxos futuros vivos e geração de `cashflow_wall.json`. |
| `src/cp_site/atualiza_assets_master.py`| `atualiza_assets_master` | Enriquecimento cadastral de duration calculada no dataset central de ativos. |
| `src/cp_telegram/morning_report.py` | `montar_mensagem_matinal` | Monitor diário de eventos do dia, volume financeiro e maiores pagadores. |
| `imob_web/` e `fixdata/` (Frontend) | `src/utils/calculatorMath.ts` | Motor matemático client-side em TypeScript para simulação de cenários, MTM e gross-up. |

---

## 3.2 Comandos Rápidos de Validação e Execução

Para testar e validar o funcionamento dos módulos em linha de comando:

```bash
# 1. Testar o motor matemático de Duration e Feriados Móveis:
python3 -m cp_anbima.calculadora_duration

# 2. Executar a consolidação da Agenda de Pagamentos:
python3 -m cp_fluxo_pagamentos.main

# 3. Processar a projeção dos 111.000+ fluxos futuros e gerar o cashflow_wall.json:
python3 -m cp_fluxos_futuros.main

# 4. Simular o relatório matinal de pagamentos do Telegram:
python3 -m cp_telegram.morning_report
```

---

## 3.3 Matriz de Resolução de Problemas (Troubleshooting)

| Sintoma Observado | Causa Mais Provável | Ação Corretiva Imediata |
| :--- | :--- | :--- |
| **Ativo aparece pagando em duas datas consecutivas (ex: dias 15 e 16)** | Colisão entre Data Base contratual e Data Útil de liquidação provenientes de fontes distintas. | O passo 2 de `sanity_check_e_deduplicacao` (janela $\le 7$ dias) unifica automaticamente. Verificar se a flag de prioridade de fonte está configurada corretamente no módulo `cp_fluxo_pagamentos/main.py`. |
| **Duration retornando `None` ou `0.0` para um ativo** | Data de vencimento nula, malformada ou no passado; ativo vencido ainda classificado como vivo. | Inspecionar a data em `tb_cadastro_ativos`. A função `count_business_days` rejeita datas anteriores a `data_base`. Executar `python3 -m cp_cadastro_ativos.main`. |
| **Erro `OperationalError: no such table: ..._old` no Airflow** | Swap inseguro de tabelas SQLite com `ALTER TABLE ... RENAME TO` enquanto leitores concorrentes consultavam a view. | Manter a regra cardeal: **Nunca renomear tabelas de produção diretamente**. Utilizar sempre o padrão de Staging seguro (`DELETE FROM target; INSERT INTO target SELECT * FROM staging; DROP TABLE staging;`). |
| **Volume financeiro do ativo inflado (> R$ 15 Bilhões)** | Título de CRI/CRA com quantidade de cotas multiplicada indevidamente por PU R$ 1.000 em vez de PU nominal R$ 1,00. | O módulo `cp_fluxos_futuros/main.py` possui trava de sanidade automática que identifica securitizações com PU unitário de R$ 1,00 e teto de R$ 15 Bi por emissão privada. |
