/**
 * Audit fixtures now live in the central mock provider so the audit log
 * resolves through the same offline transport as every other dashboard
 * entity. Re-exported here for feature-local imports.
 */
export { MOCK_AUDIT_EVENTS } from '@/services/mock/audit';
