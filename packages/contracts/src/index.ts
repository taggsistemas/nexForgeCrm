export const permissions = ["tenant:read","tenant:admin","company:read","company:manage","user:read","user:manage","role:manage","team:manage","region:read","region:manage","portfolio:read","portfolio:manage","lead:read","lead:write","customer:read","customer:write","contact:read","contact:write","pipeline:read","pipeline:write","activity:read","activity:write","visit:read","visit:write","proposal:read","proposal:write","proposal:approve","order:read","order:write","order:approve","catalog:read","catalog:manage","goal:read","goal:manage","commission:read","commission:manage","forecast:read","report:read"] as const;
export type Permission = typeof permissions[number];
export interface AccessContext {
  userId: string;
  tenantId: string;
  companyIds: readonly string[];
  permissions: readonly Permission[];
  onboarding?: {passwordChangeRequired:boolean;privacyAcceptanceRequired:boolean};
  dataAccess?: { visibility: 'company' | 'team' | 'own'; supervisedUserIds: readonly string[] };
}
export interface IntegrationEvent<T> {
  eventId: string;
  type: string;
  schemaVersion: 1;
  source: 'nexforge-crm' | 'nexforge-erp';
  occurredAt: string;
  tenantRef: string;
  companyRef?: string;
  correlationId: string;
  payload: T;
}