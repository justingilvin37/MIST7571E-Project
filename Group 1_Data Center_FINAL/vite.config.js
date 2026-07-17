import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { config as dotenvConfig } from 'dotenv';
import { getLocationContext } from './api/context.js';
import { analyzeContext } from './api/analyze.js';

dotenvConfig();

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString('utf8');

  if (!text) {
    return {};
  }

  return JSON.parse(text);
}

function createApiRoutesPlugin() {
  return {
    name: 'local-api-routes',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url, 'http://localhost');

        if (!url.pathname.startsWith('/api/')) {
          return next();
        }

        response.setHeader('Content-Type', 'application/json');

        try {
          if (url.pathname === '/api/context' && request.method === 'GET') {
            const search = String(url.searchParams.get('search') || '').trim();

            if (!search) {
              response.statusCode = 400;
              return response.end(
                JSON.stringify({ error: 'A city or ZIP code search is required.' })
              );
            }

            const context = await getLocationContext(search);
            return response.end(JSON.stringify(context));
          }

          if (url.pathname === '/api/analyze' && request.method === 'POST') {
            const body = await readJsonBody(request);
            const { context, risk, averageDataCenter } = body || {};

            if (!context?.location || !risk) {
              response.statusCode = 400;
              return response.end(
                JSON.stringify({ error: 'Location context and risk data are required.' })
              );
            }

            const brief = await analyzeContext({
              context,
              risk,
              averageDataCenter
            });

            return response.end(JSON.stringify({ brief }));
          }

          response.statusCode = 404;
          return response.end(JSON.stringify({ error: 'API route not found.' }));
        } catch (error) {
          response.statusCode = 500;
          return response.end(
            JSON.stringify({
              error:
                error?.message ||
                'An unexpected API error occurred. Please check your server logs.'
            })
          );
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url, 'http://localhost');

        if (!url.pathname.startsWith('/api/')) {
          return next();
        }

        response.setHeader('Content-Type', 'application/json');

        try {
          if (url.pathname === '/api/context' && request.method === 'GET') {
            const search = String(url.searchParams.get('search') || '').trim();

            if (!search) {
              response.statusCode = 400;
              return response.end(
                JSON.stringify({ error: 'A city or ZIP code search is required.' })
              );
            }

            const context = await getLocationContext(search);
            return response.end(JSON.stringify(context));
          }

          if (url.pathname === '/api/analyze' && request.method === 'POST') {
            const body = await readJsonBody(request);
            const { context, risk, averageDataCenter } = body || {};

            if (!context?.location || !risk) {
              response.statusCode = 400;
              return response.end(
                JSON.stringify({ error: 'Location context and risk data are required.' })
              );
            }

            const brief = await analyzeContext({
              context,
              risk,
              averageDataCenter
            });

            return response.end(JSON.stringify({ brief }));
          }

          response.statusCode = 404;
          return response.end(JSON.stringify({ error: 'API route not found.' }));
        } catch (error) {
          response.statusCode = 500;
          return response.end(
            JSON.stringify({
              error:
                error?.message ||
                'An unexpected API error occurred. Please check your server logs.'
            })
          );
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  process.env = {
    ...process.env,
    ...loadEnv(mode, process.cwd())
  };

  return {
    plugins: [react(), createApiRoutesPlugin()]
  };
});
