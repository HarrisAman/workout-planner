import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connect } from './db.js';
import router from './routes.js';
import * as gh from './github.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json());
app.use('/api', router);

const port = process.env.PORT || 4000;

connect()
  .then(() => {
    app.listen(port, () => {
      console.log(`API running on http://localhost:${port}`);
      console.log(gh.enabled() ? `GitHub history: ON (${gh.repoName()})` : 'GitHub history: OFF (set GITHUB_* in server/.env)');
    });
  })
  .catch((err) => {
    console.error('Startup failed:', err.message);
    process.exit(1);
  });
