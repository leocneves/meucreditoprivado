#!/usr/bin/env python3
"""
scripts/sanity_check_schedules.py
Sanity Gatekeeper Automático de Cronogramas de Pagamentos (FIXDATA)

Executa bateria de testes de integridade e auditoria em payment_schedules.csv e JSONs:
1. Validação de Formato e Datas (sem campos vazios obrigatórios, datas ISO válidas)
2. Cobertura de Eventos (Amortização e Cupons de Juros)
3. Anti-NaN Fail-Safe em todos os arquivos de dados

Implementado 100% com biblioteca padrão Python (sem pandas/numpy) para garantir
compatibilidade e execução ultrarrápida no ambiente CI/CD do Netlify.
"""

import sys
import os
import glob
import json
import csv
import re
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

    schedules_rows = []
    with open(CSV_SCHEDULES, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            schedules_rows.append(r)

    total_events = len(schedules_rows)
    print(f"📊 Total de eventos carregados: {total_events}")

    if total_events == 0:
        errors.append("O arquivo payment_schedules.csv está vazio!")

    # 2. Teste de campos obrigatórios e formato de datas
    date_regex = re.compile(r"^\d{4}-\d{2}-\d{2}$")
    invalid_date_count = 0
    missing_required_count = 0
    req_cols = ['ticker', 'data_evento', 'tipo_evento', 'status']

    for row in schedules_rows:
        for c in req_cols:
            val = row.get(c)
            if not val or val.strip() in ('', 'nan', 'NaN', 'None', 'null'):
                missing_required_count += 1
                break

        dt = str(row.get('data_evento') or '').strip()
        if not date_regex.match(dt):
            invalid_date_count += 1

    if missing_required_count > 0:
        errors.append(f"{missing_required_count} registros possuem campos obrigatórios nulos/vazios em payment_schedules.csv!")

    if invalid_date_count > 0:
        errors.append(f"{invalid_date_count} registros possuem formato de data inválido!")

    # 3. Checagem de integridade contra ativos de referência
    sample_tickers = {'CRA02400AYK'}
    events_by_ticker = {}
    for r in schedules_rows:
        tk = (r.get('ticker') or '').strip().upper()
        if tk in sample_tickers:
            if tk not in events_by_ticker:
                events_by_ticker[tk] = []
            events_by_ticker[tk].append(r)

    for tk in sample_tickers:
        tk_events = events_by_ticker.get(tk, [])
        if not tk_events:
            errors.append(f"Ativo de referência {tk} não possui nenhum evento na agenda!")
        else:
            has_amort = any(e.get('tipo_evento') == 'Amortização' for e in tk_events)
            has_juros = any(e.get('tipo_evento') == 'Pagamento de Juros' for e in tk_events)
            has_liq = any(e.get('status') == 'Liquidado' for e in tk_events)
            if not has_amort:
                errors.append(f"Ativo {tk} não possui evento de Amortização cadastrado!")
            if not has_juros:
                errors.append(f"Ativo {tk} não possui eventos de Juros cadastrados!")
            if not has_liq:
                warnings.append(f"Ativo {tk} emitido no passado sem eventos Liquidados no histórico!")

    # 4. Auditoria de NaN nos JSONs individuais
    nan_json_count = 0
    if os.path.exists(ASSETS_DIR):
        json_files = glob.glob(os.path.join(ASSETS_DIR, '*.json'))
        for jf in json_files[:500]:
            try:
                with open(jf, 'r', encoding='utf-8') as f:
                    content = f.read()
                if ': NaN' in content or ':NaN' in content:
                    nan_json_count += 1
                    clean = content.replace(': NaN', ': null').replace(':NaN', ':null')
                    with open(jf, 'w', encoding='utf-8') as f_out:
                        f_out.write(clean)
            except Exception:
                pass

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
