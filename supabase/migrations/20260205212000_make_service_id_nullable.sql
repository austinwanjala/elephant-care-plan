-- Make service_id nullable in visits table to allow registration without immediate service selection
ALTER TABLE "public"."visits" ALTER COLUMN "service_id" DROP NOT NULL;
