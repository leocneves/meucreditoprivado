import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode, command }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      publicDir: command === 'build' ? false : 'public',
      build: {
        outDir: 'docs',
        emptyOutDir: false,
      },
      plugins: [
        react(),
        {
          name: 'local-news-api-middleware',
          configureServer(server) {
            server.middlewares.use('/api/news', async (req, res) => {
              try {
                const urlObj = new URL(req.url || '', 'http://localhost');
                const q = urlObj.searchParams.get('q');
                if (!q) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: "Missing query 'q'" }));
                  return;
                }
                const { handler } = await import('./netlify/functions/news.js');
                const result = await handler({ queryStringParameters: { q } });
                res.statusCode = result.statusCode || 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(result.body);
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err?.message || 'Server error' }));
              }
            });
          }
        }
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
