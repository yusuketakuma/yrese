import { buildServer } from './server.js';
import { parseApiPort } from './config.js';

const port = parseApiPort(process.env.PORT);

const server = buildServer();

try {
  server.log.info({ port }, 'API server port selected');
  const address = await server.listen({ host: '0.0.0.0', port });
  server.log.info({ address }, 'API server listening');
} catch (error) {
  server.log.error(error, 'API server failed to start');
  process.exitCode = 1;
}
