CREATE TABLE `aircraft` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tail_number` varchar(20) NOT NULL,
	`model` varchar(100) NOT NULL,
	`manufacturer` varchar(100) NOT NULL,
	`industry` enum('aviation','manufacturing') NOT NULL DEFAULT 'aviation',
	`specs` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aircraft_id` PRIMARY KEY(`id`),
	CONSTRAINT `aircraft_tail_number_unique` UNIQUE(`tail_number`)
);
--> statement-breakpoint
CREATE TABLE `compliance_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inspection_id` int NOT NULL,
	`report_number` varchar(64) NOT NULL,
	`faa_form_type` varchar(50) DEFAULT '8130-3',
	`content` json NOT NULL,
	`generated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `compliance_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `compliance_reports_inspection_id_unique` UNIQUE(`inspection_id`),
	CONSTRAINT `compliance_reports_report_number_unique` UNIQUE(`report_number`)
);
--> statement-breakpoint
CREATE TABLE `inspection_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inspection_id` int NOT NULL,
	`step_number` int NOT NULL,
	`category` varchar(100) NOT NULL,
	`step_name` varchar(200) NOT NULL,
	`worker_input` text,
	`ai_response` text,
	`status` enum('pending','in_progress','passed','failed','skipped') DEFAULT 'pending',
	`reading_value` varchar(100),
	`reading_unit` varchar(50),
	`is_in_spec` boolean,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inspection_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inspections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` varchar(64) NOT NULL,
	`aircraft_id` int NOT NULL,
	`inspector_name` varchar(200),
	`status` enum('in_progress','completed','aborted') DEFAULT 'in_progress',
	`total_steps` int DEFAULT 0,
	`completed_steps` int DEFAULT 0,
	`safety_checks_passed` int DEFAULT 0,
	`safety_checks_failed` int DEFAULT 0,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `inspections_id` PRIMARY KEY(`id`),
	CONSTRAINT `inspections_session_id_unique` UNIQUE(`session_id`)
);
--> statement-breakpoint
CREATE TABLE `safety_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inspection_id` int NOT NULL,
	`step_id` int,
	`severity` enum('critical','warning','info') NOT NULL,
	`title` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`parameter` varchar(100),
	`actual_value` varchar(100),
	`expected_range` varchar(100),
	`acknowledged` boolean DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `safety_alerts_id` PRIMARY KEY(`id`)
);
