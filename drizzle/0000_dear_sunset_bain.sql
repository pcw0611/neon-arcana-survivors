CREATE TABLE `leaderboard_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player` text NOT NULL,
	`score` integer NOT NULL,
	`kills` integer NOT NULL,
	`level` integer NOT NULL,
	`duration` integer NOT NULL,
	`victory` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `leaderboard_score_idx` ON `leaderboard_scores` (`score`,`created_at`);