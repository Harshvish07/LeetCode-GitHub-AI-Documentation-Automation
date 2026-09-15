import 'dotenv/config';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 4000);
const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

const app = createApp({ corsOrigin });

app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});
