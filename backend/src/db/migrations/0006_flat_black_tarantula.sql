ALTER TABLE "purchase_order_items" ALTER COLUMN "unit_cost" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "requested_by" uuid;--> statement-breakpoint
UPDATE "purchase_orders" SET "requested_by" = (SELECT "id" FROM "users" ORDER BY "created_at" LIMIT 1) WHERE "requested_by" IS NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "requested_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."purchase_orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."purchase_order_status";--> statement-breakpoint
CREATE TYPE "public"."purchase_order_status" AS ENUM('DRAFT_PR', 'PO_ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
ALTER TABLE "public"."purchase_orders" ALTER COLUMN "status" SET DATA TYPE "public"."purchase_order_status" USING "status"::"public"."purchase_order_status";--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "status" SET DEFAULT 'DRAFT_PR';