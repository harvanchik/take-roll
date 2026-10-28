import { sqliteTable, text, integer, index, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';
export const attendanceStores = sqliteTable('attendance_stores', {
  userId: text('user_id').primaryKey(),
  data: text('data').notNull(),
  revision: integer('revision').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});

export const requestLimits=sqliteTable('request_limits',{key:text('key').primaryKey(),window:integer('window').notNull(),hits:integer('hits').notNull()});

export const organizations=sqliteTable('organizations',{id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),ownerEmail:text('owner_email').notNull(),createdAt:text('created_at').notNull()},table=>[index('organizations_owner_email_idx').on(table.ownerEmail),index('organizations_owner_id_idx').on(table.ownerId)]);
export const organizationMembers=sqliteTable('organization_members',{id:text('id').primaryKey(),organizationId:text('organization_id').notNull().references(()=>organizations.id),email:text('email').notNull(),accountId:text('account_id'),invitedBy:text('invited_by').notNull(),createdAt:text('created_at').notNull()},table=>[index('organization_members_workspace_idx').on(table.organizationId),uniqueIndex('organization_members_workspace_email_unique').on(table.organizationId,table.email),uniqueIndex('organization_members_workspace_account_unique').on(table.organizationId,table.accountId),index('organization_members_account_idx').on(table.accountId),index('organization_members_email_idx').on(table.email)]);
export const accountSettings=sqliteTable('account_settings',{accountId:text('account_id').primaryKey(),data:text('data').notNull()});
export const organizationHistoryActors=sqliteTable('organization_history_actors',{
 organizationId:text('organization_id').notNull().references(()=>organizations.id),
 accountId:text('account_id').notNull(),displayName:text('display_name').notNull(),
},table=>[primaryKey({columns:[table.organizationId,table.accountId]})]);
export const legalAcceptances=sqliteTable('legal_acceptances',{
 accountId:text('account_id').notNull(),version:text('version').notNull(),documentHash:text('document_hash').notNull(),
 acceptedAt:text('accepted_at').notNull(),adultConfirmed:integer('adult_confirmed').notNull(),
},table=>[primaryKey({columns:[table.accountId,table.version]})]);

// Remains after workspace deletion so the initial workspace is never resurrected.
export const workspaceAccounts=sqliteTable('workspace_accounts',{accountId:text('account_id').primaryKey(),createdAt:text('created_at').notNull()});
