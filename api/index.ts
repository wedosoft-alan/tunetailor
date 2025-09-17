// Reuse the main Express app (with sessions and all routes) for Vercel serverless.
// This fixes 404s like /api/generate-playlist by ensuring the same routes run in prod.
export { default } from "../server/index";
