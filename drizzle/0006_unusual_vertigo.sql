CREATE TABLE `legal_acceptances` (
	`account_id` text NOT NULL,
	`version` text NOT NULL,
	`document_hash` text NOT NULL,
	`accepted_at` text NOT NULL,
	`adult_confirmed` integer NOT NULL,
	PRIMARY KEY(`account_id`, `version`)
);
