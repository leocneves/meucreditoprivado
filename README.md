
# Meu Crédito Privado

Este é um site estático para consulta e acompanhamento de ativos de crédito privado, funcionando inteiramente no navegador (client-side) e consumindo dados através de arquivos CSV.

## 🚀 Como rodar localmente

Requisito: **Node 18+**

1. Clone o repositório.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
4. Acesse em seu navegador: [http://localhost:5173](http://localhost:5173)

## 📦 Build e Deploy (GitHub Pages)

O projeto está configurado para gerar a build na pasta `docs/`, facilitando o deploy no GitHub Pages.

1. Gere a build:
   ```bash
   npm run build
   ```
   Isso criará a pasta `docs/` na raiz do projeto.
2. No GitHub, vá em **Settings** -> **Pages**.
3. Em **Build and deployment** > **Branch**, selecione a branch `main` (ou sua branch principal) e a pasta `/docs`.
4. Salve e aguarde o GitHub disponibilizar a URL.

## 🛠️ Detalhes Técnicos

- **Base Path**: Configurado como `./` no `vite.config.js` para compatibilidade total com subpastas do GitHub Pages.
- **CSV Data**: Os dados são lidos de `./data/*.csv` usando `PapaParse`. Para o site funcionar, a pasta `data/` deve estar presente dentro de `public/` (no desenvolvimento) para que seja copiada para a raiz da build final.
- **Watchlist**: Salva localmente via `localStorage`. Não há necessidade de banco de dados ou backend.
- **Busca**: Utiliza `Fuse.js` para busca fuzzy por ticker e nome do emissor.
- **Gráficos**: Implementados com `Chart.js` e `react-chartjs-2`.

## 📁 Estrutura de Dados
- `assets_master.csv`: Cadastro central dos ativos.
- `prices.csv`: Histórico de preços secundários.
- `_metadata.json`: Informações de controle de atualização (exibido na Home).
- `offers.csv`: (Opcional) Lista de ofertas do mercado primário.
