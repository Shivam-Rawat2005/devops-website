'use strict';

const { createApp } = require('./app');

const port = Number.parseInt(process.env.PORT, 10) || 3000;
const app = createApp({ staticDir: process.env.STATIC_DIR });

const server = app.listen(port, () => {
  console.log(JSON.stringify({ type: 'startup', port, environment: process.env.APP_ENV || 'development', commit: process.env.GIT_SHA || 'local' }));
});

// Docker sends SIGTERM on `docker stop`; finish open requests before exiting.
function shutdown(signal) {
  console.log(JSON.stringify({ type: 'shutdown', signal }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
