import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { apiRouter } from "./server/api.js";
import dotenv from "dotenv";
import morgan from "morgan";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust all proxies (Google Cloud Load Balancer + Nginx) to get correct client IPs for rate limiting
  app.set("trust proxy", 1);

  // Add Request Logging Middleware
  app.use(morgan("dev"));

  // Add Security Headers Middleware
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV !== "production"
          ? {
              directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                "connect-src": ["'self'", "ws:", "wss:"],
              },
            }
          : undefined,
    }),
  );

  app.use(express.json({ limit: "10kb" }));

  // Baseline global rate limiter to protect middleware/routes doing filesystem and other expensive work.
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
  );

  // Use modular API router
  app.use("/api", apiRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
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
