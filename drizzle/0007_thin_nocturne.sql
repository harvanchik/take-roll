CREATE TABLE `workspace_accounts` (
	`account_id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
DROP INDEX `organization_members_email_unique`;--> statement-breakpoint
DROP INDEX `organization_members_account_id_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `organization_members_workspace_email_unique` ON `organization_members` (`organization_id`,`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `organization_members_workspace_account_unique` ON `organization_members` (`organization_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `organization_members_account_idx` ON `organization_members` (`account_id`);--> statement-breakpoint
CREATE INDEX `organization_members_email_idx` ON `organization_members` (`email`);--> statement-breakpoint
DROP INDEX `organizations_owner_id_unique`;--> statement-breakpoint
CREATE INDEX `organizations_owner_id_idx` ON `organizations` (`owner_id`);