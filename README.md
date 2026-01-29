
# Meu Crédito Privado

Plataforma de análise de crédito privado estática.

## Como fazer o Deploy Manual (GitHub Pages)

1. **Instalar dependências**:
   ```bash
   npm install
   ```

2. **Gerar o Build**:
   Execute o comando abaixo para gerar a pasta `docs/`:
   ```bash
   npm run build
   ```

3. **Commit e Push**:
   ```bash
   git add .
   git commit -m "Build para deploy"
   git push origin main
   ```

4. **Configuração no GitHub**:
   - Vá para o seu repositório no GitHub.
   - Clique em **Settings** > **Pages**.
   - Em **Build and deployment**, sob **Source**, selecione `Deploy from a branch`.
   - Selecione a branch `main` e a pasta `/docs`.
   - Clique em **Save**.

Seu site estará disponível em breve no domínio `https://seu-usuario.github.io/seu-repositorio/`.

## Atualização de Dados
Para atualizar os dados, basta modificar os arquivos na pasta `/data/`, rodar `npm run build` e fazer o push novamente.
