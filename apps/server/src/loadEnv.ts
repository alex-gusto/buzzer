import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootEnvPath = path.resolve(__dirname, '../../.env');

if (existsSync(rootEnvPath)) {
  try {
    const contents = readFileSync(rootEnvPath, 'utf-8');
    for (const line of contents.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) {
        continue;
      }
      const eqIndex = line.indexOf('=');
      if (eqIndex === -1) {
        continue;
      }
      const key = line.slice(0, eqIndex).trim();
      const value = line.slice(eqIndex + 1).trim();
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    console.warn('Failed to load .env file', error);
  }
}
