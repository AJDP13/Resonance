import path from 'node:path';
import next from 'next';
import { createResonanceServer } from './app-server';

const dev = process.env.NODE_ENV !== 'production';
const port = Number.parseInt(process.env.PORT ?? '8080', 10) || 8080;
const dir = path.resolve(__dirname, '../..');

async function main(): Promise<void> {
  const nextApp = next({ dev, dir });
  await nextApp.prepare();
  const handle = nextApp.getRequestHandler();

  const { httpServer } = createResonanceServer((req, res) => handle(req, res));

  httpServer.listen(port, '0.0.0.0', () => {
    process.stdout.write(`Resonance ready on http://localhost:${port}\n`);
  });
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`Failed to start Resonance server: ${message}\n`);
  process.exit(1);
});
