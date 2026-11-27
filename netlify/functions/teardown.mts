// Netlify Function: GET /api/teardown?ticker=XXX (ADR 0001). Thin wrapper over src/api/handler.ts.
import { defaultDeps, handleRequest } from "../../src/api/handler";

export default async (req: Request): Promise<Response> => handleRequest(req, defaultDeps());

export const config = { path: "/api/teardown" };
