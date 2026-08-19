CREATE TABLE `ai_requests` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`workspace_id` varchar(64),
	`prompt` varchar(8000) NOT NULL,
	`intent` varchar(80),
	`status` enum('planned','approved','applied','rejected','failed') NOT NULL DEFAULT 'planned',
	`response` json,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`completed_at` timestamp,
	CONSTRAINT `ai_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `connected_wallets` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`chain` enum('ethereum','solana') NOT NULL,
	`address` varchar(128) NOT NULL,
	`provider` varchar(120) NOT NULL,
	`label` varchar(120),
	`chain_id` varchar(32),
	`last_seen_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `connected_wallets_id` PRIMARY KEY(`id`),
	CONSTRAINT `connected_wallet_user_chain_address_unique` UNIQUE(`user_id`,`chain`,`address`)
);
--> statement-breakpoint
CREATE TABLE `feature_permissions` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`feature_key` varchar(100) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`config` json NOT NULL DEFAULT ('{}'),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `feature_permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `feature_permissions_user_feature_unique` UNIQUE(`user_id`,`feature_key`)
);
--> statement-breakpoint
CREATE TABLE `portfolio_snapshots` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`chain` enum('ethereum','solana') NOT NULL,
	`address` varchar(128) NOT NULL,
	`total_value_usd` bigint NOT NULL DEFAULT 0,
	`payload` json NOT NULL,
	`captured_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `portfolio_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `public_addresses` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`chain` enum('ethereum','solana') NOT NULL,
	`address` varchar(128) NOT NULL,
	`label` varchar(120),
	`notes` varchar(1000),
	`source` enum('watch','generated','connected') NOT NULL DEFAULT 'watch',
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `public_addresses_id` PRIMARY KEY(`id`),
	CONSTRAINT `public_addresses_user_chain_address_unique` UNIQUE(`user_id`,`chain`,`address`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(64) NOT NULL,
	`email` varchar(320) NOT NULL,
	`display_name` varchar(120),
	`avatar_url` varchar(512),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `workspace_revisions` (
	`id` varchar(64) NOT NULL,
	`workspace_id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`source` enum('manual','ai','system') NOT NULL,
	`prompt` varchar(4000),
	`summary` varchar(500) NOT NULL,
	`snapshot` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `workspace_revisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspace_widgets` (
	`id` varchar(64) NOT NULL,
	`workspace_id` varchar(64) NOT NULL,
	`widget_type` varchar(80) NOT NULL,
	`title` varchar(160),
	`enabled` boolean NOT NULL DEFAULT true,
	`position` int NOT NULL DEFAULT 0,
	`width` enum('small','medium','large','full') NOT NULL DEFAULT 'medium',
	`config` json NOT NULL DEFAULT ('{}'),
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspace_widgets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL DEFAULT 'My AvhiSafe workspace',
	`theme` enum('light','dark','system') NOT NULL DEFAULT 'system',
	`currency` varchar(8) NOT NULL DEFAULT 'USD',
	`density` enum('comfortable','compact','analytics') NOT NULL DEFAULT 'comfortable',
	`is_default` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ai_requests_user_created_idx` ON `ai_requests` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `connected_wallets_user_idx` ON `connected_wallets` (`user_id`);--> statement-breakpoint
CREATE INDEX `portfolio_snapshots_user_captured_idx` ON `portfolio_snapshots` (`user_id`,`captured_at`);--> statement-breakpoint
CREATE INDEX `public_addresses_user_idx` ON `public_addresses` (`user_id`);--> statement-breakpoint
CREATE INDEX `revisions_workspace_created_idx` ON `workspace_revisions` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `widgets_workspace_position_idx` ON `workspace_widgets` (`workspace_id`,`position`);--> statement-breakpoint
CREATE INDEX `workspaces_user_idx` ON `workspaces` (`user_id`);