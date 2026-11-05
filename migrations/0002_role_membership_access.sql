ALTER TYPE "public"."user_role" ADD VALUE 'packet_staff';--> statement-breakpoint
CREATE TABLE "case_members" (
	"case_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_members_case_id_user_id_pk" PRIMARY KEY("case_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "case_members" ADD CONSTRAINT "case_members_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "case_members" ADD CONSTRAINT "case_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE restrict;