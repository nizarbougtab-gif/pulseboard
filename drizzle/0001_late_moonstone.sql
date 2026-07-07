CREATE TABLE `activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`patientId` int,
	`userId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`patientId` int,
	`alertType` enum('dps_missing','no_bed','task_overdue','critical_patient') NOT NULL,
	`message` text NOT NULL,
	`resolved` boolean DEFAULT false,
	`resolvedAt` timestamp,
	`resolvedById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hospitals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`city` varchar(100) NOT NULL DEFAULT 'Dakar',
	`address` text,
	`phone` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `hospitals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patient_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`serviceId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`priority` enum('low','medium','high','urgent') DEFAULT 'medium',
	`taskStatus` enum('pending','in_progress','completed','overdue') DEFAULT 'pending',
	`dueDate` timestamp,
	`assignedToId` int,
	`completedAt` timestamp,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `patient_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firstName` varchar(100) NOT NULL,
	`lastName` varchar(100) NOT NULL,
	`dateOfBirth` varchar(10),
	`gender` enum('M','F') DEFAULT 'M',
	`phone` varchar(50),
	`emergencyContact` varchar(255),
	`serviceId` int NOT NULL,
	`bedNumber` int,
	`status` enum('stable','modere','critique') NOT NULL DEFAULT 'stable',
	`admissionDate` timestamp NOT NULL DEFAULT (now()),
	`expectedDischarge` timestamp,
	`actualDischarge` timestamp,
	`diagnosis` text,
	`allergies` text,
	`antecedents` text,
	`notes` text,
	`dpsCompleted` boolean DEFAULT false,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `patients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `releves` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`generatedById` int NOT NULL,
	`content` text NOT NULL,
	`pdfUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `releves_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`userId` int NOT NULL,
	`memberRole` enum('chef','senior','junior','stagiaire') DEFAULT 'junior',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `service_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `service_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`specialty` varchar(100) NOT NULL,
	`hospitalId` int NOT NULL,
	`createdById` int NOT NULL,
	`totalBeds` int DEFAULT 20,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `medicalRole` enum('externe','interne','resident','medecin') DEFAULT 'interne';--> statement-breakpoint
ALTER TABLE `users` ADD `hospitalId` int;