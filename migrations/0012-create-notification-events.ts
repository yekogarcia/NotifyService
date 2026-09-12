import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationEvents1700000000012 implements MigrationInterface {
  name = 'CreateNotificationEvents1700000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "notification_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "notification_id" uuid,
        "delivery_id" uuid,
        "event_type" varchar(100) NOT NULL,
        "correlation_id" uuid NOT NULL,
        "source_system" varchar(255),
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_events_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_events_notification" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_events_delivery" FOREIGN KEY ("delivery_id") REFERENCES "notification_deliveries"("id") ON DELETE SET NULL
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_events_notification" ON "notification_events" ("notification_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_events_correlation" ON "notification_events" ("correlation_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_events_tenant_created" ON "notification_events" ("tenant_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notification_events"`);
  }
}
