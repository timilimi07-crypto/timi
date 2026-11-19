CREATE TABLE "explanation_cache" (
	"rule_id" text PRIMARY KEY NOT NULL,
	"sprache" char(2) DEFAULT 'de' NOT NULL,
	"titel" text NOT NULL,
	"erklaerung_einfach" text NOT NULL,
	"was_tun" text NOT NULL,
	"betrifft_mich_als_empfaenger" boolean NOT NULL,
	"quelle" text DEFAULT 'llm' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
