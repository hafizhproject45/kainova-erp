ALTER TABLE "product_variants" ADD COLUMN "lead_time_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "safety_stock" integer DEFAULT 0 NOT NULL;