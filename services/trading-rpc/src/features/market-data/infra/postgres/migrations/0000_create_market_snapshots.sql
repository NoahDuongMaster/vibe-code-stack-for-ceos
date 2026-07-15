CREATE SCHEMA IF NOT EXISTS "market_data";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "market_data"."market_snapshots" (
	"coin_id" text NOT NULL,
	"quote_currency" text NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"image_url" text,
	"current_price" double precision,
	"market_cap" double precision,
	"market_cap_rank" integer,
	"price_change_24h" double precision,
	"price_change_percentage_24h" double precision,
	"total_volume" double precision,
	"source_updated_at" timestamp with time zone,
	"persisted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_snapshots_coin_id_quote_currency_pk" PRIMARY KEY("coin_id","quote_currency"),
	CONSTRAINT "market_snapshots_coin_id_not_blank" CHECK (LENGTH(BTRIM("market_data"."market_snapshots"."coin_id")) > 0),
	CONSTRAINT "market_snapshots_quote_currency_not_blank" CHECK (LENGTH(BTRIM("market_data"."market_snapshots"."quote_currency")) > 0),
	CONSTRAINT "market_snapshots_symbol_not_blank" CHECK (LENGTH(BTRIM("market_data"."market_snapshots"."symbol")) > 0),
	CONSTRAINT "market_snapshots_name_not_blank" CHECK (LENGTH(BTRIM("market_data"."market_snapshots"."name")) > 0),
	CONSTRAINT "market_snapshots_rank_positive" CHECK ("market_data"."market_snapshots"."market_cap_rank" IS NULL OR "market_data"."market_snapshots"."market_cap_rank" > 0)
);
