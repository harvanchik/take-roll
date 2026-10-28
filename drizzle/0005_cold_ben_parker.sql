CREATE TABLE `organization_history_actors` (
	`organization_id` text NOT NULL,
	`account_id` text NOT NULL,
	`display_name` text NOT NULL,
	PRIMARY KEY(`organization_id`, `account_id`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
