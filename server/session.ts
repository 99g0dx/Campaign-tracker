import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";

export function setupSession(app: Express) {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const isProduction = process.env.NODE_ENV === "production";
  const appUrl = process.env.APP_URL || "http://localhost:5000";

  // Extract domain for production cookie
  let cookieDomain: string | undefined;
  if (isProduction && appUrl) {
    try {
      const url = new URL(appUrl);
      cookieDomain = url.hostname;
    } catch (e) {
      console.error("[Session] Invalid APP_URL:", appUrl);
    }
  }

  // If DATABASE_URL is not set, fall back to in-memory session store for local dev
  if (!process.env.DATABASE_URL && !isProduction) {
    app.set("trust proxy", 1);
    app.use(
      session({
        secret: process.env.SESSION_SECRET || "dev-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: false,
          maxAge: sessionTtl,
        },
      })
    );
    console.log("[Session] Using in-memory store for development");
    return;
  }

  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  app.set("trust proxy", 1);
  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",  // FIX: Add SameSite for CSRF protection
        domain: cookieDomain,  // FIX: Set domain for production (e.g., "dttracker.com")
        maxAge: sessionTtl,
      },
    })
  );

  console.log(`[Session] Configured for ${isProduction ? 'production' : 'development'}`);
  console.log(`[Session] Cookie domain: ${cookieDomain || 'not set (localhost)'}`);
  console.log(`[Session] Secure: ${isProduction}`);
}

export const requireUser: RequestHandler = async (req, res, next) => {
  const userId = (req.session as any)?.userId;

  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  (req as any).userId = userId;
  next();
};
