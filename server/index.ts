import { config } from './config';
import { boot } from './boot';
import { buildApp } from './app';

boot()
  .then(() => {
    const app = buildApp();
    app.listen(config.port, () => {
      console.log(`[server] listening on :${config.port}`);
    });
  })
  .catch((err) => {
    console.error('[server] boot failed:', err);
    process.exit(1);
  });
