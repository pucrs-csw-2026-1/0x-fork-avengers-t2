ALTER TABLE "activities" ADD COLUMN "registration_deadline_activity" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "activities_event_id_idx" ON "activities" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "activities_deleted_at_idx" ON "activities" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "event_roles_event_id_idx" ON "event_roles" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "events_deleted_at_idx" ON "events" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "events_created_by_idx" ON "events" USING btree ("created_by");