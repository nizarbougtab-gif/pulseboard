CREATE TABLE `clinical_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`serviceId` int NOT NULL,
	`noteType` enum('dar','soap','libre') NOT NULL DEFAULT 'dar',
	`content` text NOT NULL,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clinical_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consultations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`patientFirstName` varchar(100) NOT NULL,
	`patientLastName` varchar(100) NOT NULL,
	`motif` varchar(255) NOT NULL,
	`consultStatus` enum('en_attente','vu','reporte') NOT NULL DEFAULT 'en_attente',
	`notes` text,
	`createdById` int NOT NULL,
	`consultDate` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consultations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `observations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`serviceId` int NOT NULL,
	`content` text NOT NULL,
	`obsCategory` enum('clinique','infirmier','evolution','autre') DEFAULT 'clinique',
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `observations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vital_signs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`patientId` int NOT NULL,
	`serviceId` int NOT NULL,
	`temperature` varchar(10),
	`bloodPressure` varchar(20),
	`heartRate` varchar(10),
	`respiratoryRate` varchar(10),
	`oxygenSaturation` varchar(10),
	`gcs` varchar(10),
	`pain` varchar(10),
	`notes` text,
	`recordedById` int NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vital_signs_id` PRIMARY KEY(`id`)
);
