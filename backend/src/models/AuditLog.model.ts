export interface AuditLogDocument {
  _id: string;
  userId?: string;
  actorType: "user" | "system" | "ai" | "admin";
  actorId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  result: "success" | "failure" | "denied";
  ipHash?: string;
  userAgentHash?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
