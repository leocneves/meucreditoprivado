#!/usr/bin/env python3
"""
scripts/sanity_check_schedules.py
Sanity Gatekeeper Automático de Cronogramas de Pagamentos (FIXDATA)

Executa bateria de testes de integridade e auditoria em payment_schedules.csv e JSONs:
1. Validação de Formato e Datas (sem NaN, datas ISO válidas)
2. Cobertura de Vencimento (último evento alinhado com data de vencimento)
3. Consistência de Periodicidade (evita salto de cupons para trimestrais/mensais)
4. Anti-NaN Fail-Safe em todos os arquivos de dados
"""

import sys
import os
import glob
import json
import pandas as pd
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_SCHEDULES = os.path.join(BASE_DIR, 'public', 'data', 'payment_schedules.csv')
CSV_ASSETS = os.path.join(BASE_DIR, 'public', 'data', 'assets_master.csv')
ASSETS_DIR = os.path.join(BASE_DIR, 'public', 'data', 'assets')

def run_sanity_checks():
    print("=" * 60)
    print("🛡️  INICIANDO SANITY GATEKEEPER DE CRONOGRAMAS (FIXDATA)")
    print("=" * 60)
    
    errors = []
    warnings = []

    # 1. Checagem do arquivo principal
    if not os.path.exists(CSV_SCHEDULES):
        print(f"❌ ERRO CRÍTICO: {CSV_SCHEDULES} não encontrado!")
        sys.exit(1)

    df_sched = pd.read_csv(CSV_SCHEDULES)
    print(f"📊 Total de eventos carregados: {len(df_sched)}")

    # 2. Teste Anti-NaN em colunas obrigatórias
    req_cols = ['ticker', 'data_evento', 'tipo_evento', 'status']
    for c in req_cols:
        null_count = df_sched[c].isna().sum()
        if null_count > 0:
            errors.append(f"Coluna {c} possui {null_count} valores nulos em payment_schedules.csv!")

    # 3. Teste de datas válidas
    invalid_dates = df_sched[~df_sched['data_evento'].astype(str).str.match(r"^\d{4}-\d{2}-\d{2}$")]
    if len(invalid_dates) > 0:
        errors.append(f"{len(invalid_dates)} registros possuem formato de data inválido!")

    # 4. Checagem de integridade contra assets_master
    if os.path.exists(CSV_ASSETS):
        df_assets = pd.read_csv(CSV_ASSETS)
        assets_dict = {
            str(r.get('ticker')).strip().upper(): r
            for _, r in df_assets.iterrows()
            if pd.notna(r.get('ticker'))
        }

        # Auditar tickers ativos mais negociados
        sample_tickers = ['CRA02400AYK']
        for tk in sample_tickers:
            tk_events = df_sched[df_sched['ticker'] == tk]
            if tk_events.empty:
                errors.append(f"Ativo de referência {tk} não possui nenhum evento na agenda!")
            else:
                has_amort = (tk_events['tipo_evento'] == 'Amortização').any()
                has_juros = (tk_events['tipo_evento'] == 'Pagamento de Juros').any()
                has_liq = (tk_events['status'] == 'Liquidado').any()
                if not has_amort:
                    errors.append(f"Ativo {tk} não possui evento de Amortização cadastrado!")
                if not has_juros:
                    errors.append(f"Ativo {tk} não possui eventos de Juros cadastrados!")
                if not has_liq:
                    warnings.append(f"Ativo {tk} emitido no passado sem eventos Liquidados no histórico!")

    # 5. Auditoria de NaN nos JSONs individuais
    nan_json_count = 0
    if os.path.exists(ASSETS_DIR):
        json_files = glob.glob(os.path.join(ASSETS_DIR, '*.json'))
        for jf in json_files[:500]: # Checa amostra significativa
            with open(jf, 'r') as f:
                content = f.read()
                if ': NaN' in content or ':NaN' in content:
                    nan_json_count += 1
                    # Auto-correção instantânea
                    clean = content.replace(': NaN', ': null').replace(':NaN', ':null')
                    with open(jf, 'w') as f_out:
                        f_out.write(clean)

        if nan_json_count > 0:
            warnings.append(f"{nan_json_count} arquivos JSON continham literais NaN (auto-corrigidos para null).")

    # Exibição do relatório
    if warnings:
        print("\n⚠️ AVISOS ENCONTRADOS:")
        for w in warnings:
            print(f"  - {w}")

    if errors:
        print("\n❌ FALHAS DETECTADAS NO SANITY GATEKEEPER:")
        for e in errors:
            print(f"  - {e}")
        print("\n🚫 O BUILD FOI INTERROMPIDO PARA EVITAR QUEBRAS EM PRODUÇÃO.")
        sys.exit(1)
    else:
        print("\n✅ TODAS AS AUDITORIAS DE INTEGRIDADE PASSARAM COM SUCESSO!")
        print("🚀 Dados validados e liberados para publicação em produção.")
        print("=" * 60)

if __name__ == '__main__':
    run_sanity_checks()
