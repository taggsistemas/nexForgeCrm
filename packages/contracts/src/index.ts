export const permissions = ['tenant:read', 'company:read', 'lead:read', 'lead:write', 'visit:read', 'visit:write', 'proposal:approve'] as const;
export type Permission = typeof permissions[number];
export interface AccessContext {
  userId: string;
  tenantId: string;
  companyIds: readonly string[];
  permissions: readonly Permission[];
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