
# Meu Crédito Privado

Plataforma estática de análise de crédito privado. 

## Como Atualizar os Dados

Os dados são consumidos via arquivos CSV localizados na pasta `/data/`. Você pode atualizá-los de duas formas:

### 1. Manualmente (Sem Programação)
1. Vá até a pasta `data/` no GitHub.
2. Clique no arquivo que deseja alterar (ex: `assets_master.csv`).
3. Clique no ícone de lápis (Edit) ou arraste um novo arquivo com o mesmo nome.
4. Faça o Commit. O site será atualizado automaticamente em instantes.

### 2. Automatizado (Via Python/ETL)
Existe um esqueleto de workflow do GitHub Actions em `.github/workflows/update-data.yml`.

Para rodar o script Python automaticamente:
1. Crie o script `scripts/fetch_data.py` (exemplo abaixo).
2. Configure as credenciais necessárias nos secrets do repositório.

## Estrutura de Arquivos CSV
- `assets_master.csv`: Dados cadastrais básicos.
- `prices.csv`: Histórico de preços, spreads e yields.
- `offers.csv`: Ofertas ativas e futuras no mercado primário.
- `calendar.csv`: Datas de pagamento de juros e amortizações.
- `documents.csv`: Links para PDFs oficiais.
- `metadata.json`: Controla a data de "Última Atualização" no rodapé.

## Deploy no GitHub Pages
1. No repositório GitHub, vá em **Settings > Pages**.
2. Em **Build and deployment**, escolha "GitHub Actions" como Source.
3. O workflow do Vite fará o build e o deploy automaticamente em cada push na `main`.

---

## Exemplo de Script ETL (`scripts/fetch_data.py`)
```python
import pandas as pd
import json
from datetime import datetime

# Substitua pela sua lógica de busca (ex: API da CVM, Ambima, etc)
def get_latest_data():
    # Exemplo: Carregando dados de uma fonte externa
    # df = pd.read_excel("fonte_externa.xlsx")
    # df.to_csv("data/prices.csv", index=False)
    
    # Atualiza metadados
    meta = {"last_updated": datetime.now().isoformat()}
    with open("data/metadata.json", "w") as f:
        json.dump(meta, f)
    
    print("Dados atualizados com sucesso!")

if __name__ == "__main__":
    get_latest_data()
```
