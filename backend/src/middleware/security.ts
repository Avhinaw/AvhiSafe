import type { NextFunction, Request, Response } from "express";

export function securityHeaders(_request: Request, response: Response, next: NextFunction) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return next();
}

export function rateLimit(options: { windowMs: number; max: number; message: string }) {
  const buckets = new Map<string, { startedAt: number; count: number }>();
  return (request: Request, response: Response, next: NextFunction) => {
    const key = request.ip || request.socket.remoteAddress || "unknown";
    const now = Date.now();
    const current = buckets.get(key);
    const bucket = !current || now - current.startedAt >= options.windowMs
      ? { startedAt: now, count: 0 }
      : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > options.max) {
      response.setHeader("Retry-After", Math.ceil((bucket.startedAt + options.windowMs - now) / 1000));
      return response.status(429).json({ error: options.message });
    }
    return next();
  };
}
