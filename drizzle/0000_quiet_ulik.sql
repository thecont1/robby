CREATE TABLE `original_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_id` int NOT NULL,
	`storage_key` varchar(512) NOT NULL,
	`original_filename` varchar(255) NOT NULL,
	`content_type` varchar(128) NOT NULL,
	`byte_length` int NOT NULL,
	`sha256` varchar(64) NOT NULL,
	`credential_state` enum('unverified','verified','absent') NOT NULL DEFAULT 'unverified',
	`credential_note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `original_assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `original_assets_storage_key_unique` UNIQUE(`storage_key`),
	CONSTRAINT `original_assets_sha256_unique` UNIQUE(`sha256`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `original_assets` ADD CONSTRAINT `original_assets_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;