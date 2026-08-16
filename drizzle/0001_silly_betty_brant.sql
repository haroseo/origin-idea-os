CREATE TABLE `brands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`color` varchar(16) NOT NULL DEFAULT '#A87955',
	`tone` varchar(160) NOT NULL DEFAULT 'Quiet confidence',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `creativeAssets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`brandId` int NOT NULL,
	`ideaId` int,
	`name` varchar(180) NOT NULL,
	`assetType` enum('font','format','license') NOT NULL,
	`status` varchar(40) NOT NULL DEFAULT 'ready',
	`storageKey` varchar(512),
	`storageUrl` varchar(512),
	`metadata` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `creativeAssets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ideaVersions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ideaId` int NOT NULL,
	`versionNumber` int NOT NULL,
	`contentHash` varchar(64) NOT NULL,
	`changeSummary` varchar(280) NOT NULL,
	`snapshot` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ideaVersions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ideas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`brandId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`originalText` text NOT NULL,
	`description` text,
	`tags` text NOT NULL,
	`contentHash` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ideas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `radarReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ideaId` int NOT NULL,
	`userId` int NOT NULL,
	`resultJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `radarReports_id` PRIMARY KEY(`id`)
);
