import express from 'express';
import { healthcheckPayload } from '@iron-sci-fi/shared';

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.get('/health', (_req, res) => {
  res.json(healthcheckPayload('backend-ok'));
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on port ${port}`);
  });
}

export default app;
