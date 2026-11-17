import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { assertTestDatabase } from './db-guard';

// Har bir test fayli ishga tushishidan oldin: .env.test ni majburan yuklaydi.
process.env.NODE_ENV = 'test';
dotenv.config({ path: resolve(__dirname, '../../.env.test'), override: true });
assertTestDatabase();
