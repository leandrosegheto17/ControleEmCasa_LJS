import { Hono } from 'hono';

/** Stub do Worker: só a rota de saúde, que não toca o banco (SDD, R5). */
export const app = new Hono().get('/api/health', (c) => c.json({ ok: true }));
