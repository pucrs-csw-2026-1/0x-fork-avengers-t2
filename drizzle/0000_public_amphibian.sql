CREATE TABLE "activities" (
	"id_activity" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"title_activity" text NOT NULL,
	"description_activity" text,
	"type" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"thumbnail_url" text,
	"capacity_activity" integer,
	"workload_minutes" integer NOT NULL,
	"category_activity" text,
	"language_activity" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"created_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_roles" (
	"event_id" text NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "event_roles_event_id_role_pk" PRIMARY KEY("event_id","role")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"registration_deadline" timestamp with time zone,
	"location" jsonb,
	"capacity" integer NOT NULL,
	"category" text,
	"language" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"created_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_roles" ADD CONSTRAINT "event_roles_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;