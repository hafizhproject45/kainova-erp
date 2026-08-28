ALTER TABLE "system_settings" ADD COLUMN "business_address" text;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "business_npwp" varchar(50);--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "business_phone" varchar(30);--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "allow_negative_stock" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "low_stock_threshold" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "receipt_paper_size" varchar(10) DEFAULT '58mm' NOT NULL;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "pr_number_format" varchar(60) DEFAULT 'PR/{YYYY}/{MM}/{SEQ}' NOT NULL;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "po_number_format" varchar(60) DEFAULT 'PO/{YYYY}/{MM}/{SEQ}' NOT NULL;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "invoice_number_format" varchar(60) DEFAULT 'INV/{YYYY}/{MM}/{SEQ}' NOT NULL;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "role_permissions" jsonb;