ALTER TABLE "products" ADD COLUMN "short_description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "products" ADD COLUMN "selling_points" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "products" ADD COLUMN "specs" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "products" ADD COLUMN "seo_keywords" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "products" ADD COLUMN "ai_summary" TEXT NOT NULL DEFAULT '';
ALTER TABLE "products" ADD COLUMN "ai_generated_at" TIMESTAMP(3);

CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'mock',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "transaction_no" TEXT,
  "raw_payload" TEXT NOT NULL DEFAULT '{}',
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_transaction_no_key" ON "payments"("transaction_no");
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
