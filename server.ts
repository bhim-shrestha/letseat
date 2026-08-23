import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { apiRouter } from "./server/api.js";
import dotenv from "dotenv";
import morgan from "morgan";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

// Cross-origin hosts the browser bundle talks to directly. Helmet's default CSP
// has no connect-src, so it falls back to `default-src 'self'` and blocks all of
// these — including Firebase anonymous auth, which gates the entire search flow
// (App.tsx disables Search until userId resolves).
const CONNECT_SRC = [
  "'self'",
  "https://*.googleapis.com", // Firebase auth (identitytoolkit, securetoken) + Firestore
  "wss://*.googleapis.com", // Firestore WebChannel transport
  "https://api.bigdatacloud.net", // "Use my location" reverse geocoding
];

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Trust all proxies (Google Cloud Load Balancer + Nginx) to get correct client IPs for rate limiting
  app.set("trust proxy", 1);

  // Add Request Logging Middleware
  app.use(morgan("dev"));

  // Add Security Headers Middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "connect-src": isProduction ? CONNECT_SRC : [...CONNECT_SRC, "ws:", "wss:"],
        // Vite's dev client injects inline scripts and uses eval for HMR; the
        // production bundle needs neither (dist/index.html loads no inline script).
        "script-src": isProduction
          ? ["'self'"]
          : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        // Would rewrite http://localhost asset URLs to https in dev.
        ...(isProduction ? {} : { "upgrade-insecure-requests": null }),
      },
    },
  }));

  app.use(express.json({ limit: "10kb" }));

  // Use modular API router
  app.use("/api", apiRouter);

  // Vite middleware for development
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // The SPA fallback hits the filesystem on every unmatched path, so cap it
    // per IP. Real assets are served by express.static above and unaffected.
    const staticFallbackLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      limit: 300,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    });
    app.use(express.static(distPath));
    app.get('/*splat', staticFallbackLimiter, (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((e) => {
  console.error(e);
  process.exit(1);
});
