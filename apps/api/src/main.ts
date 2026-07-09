import { buildServer } from './server.js';

const defaultPort = 3001;
const parsedPort = Number.parseInt(process.env.PORT ?? '', 10);
const port = Number.isInteger(parsedPort) ? parsedPort : defaultPort;

const server = buildServer();

try {
  const address = await server.listen({ host: '0.0.0.0', port });
  server.log.info({ address }, 'API server listening');
} catch (error) {
  server.log.error(error, 'API server failed to start');
  process.exitCode = 1;
}
