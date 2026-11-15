// Local development server: serves the static front end and the API.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const server = express();
server.use(app);
server.use(express.static(root, { extensions: ['html'] }));
const port = Number(process.env.PORT) || 3000;
server.listen(port, () => console.log(`QA Bug Hunter Lab on http://localhost:${port}`));
