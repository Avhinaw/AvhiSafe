import type { NextFunction, Request, Response } from "express";

export function authenticatedUserId(request: Request) {
  if (!request.auth) throw new Error("Authentication required.");
  return request.auth.userId;
}

export function trustedOriginMiddleware(allowedOrigins: ReadonlySet<string>) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return next();
    const origin = request.get("origin")?.replace(/\/$/, "");
    if (origin && !allowedOrigins.has(origin)) return response.status(403).json({ error: "Request origin is not allowed." });
    return next();
  };
}
