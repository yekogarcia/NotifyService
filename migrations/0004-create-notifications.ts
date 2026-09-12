import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1700000000004 implements MigrationInterface {
  name = 'CreateNotifications1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "notifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "source_system" varchar(255) NOT NULL,
        "event_type" varchar(255) NOT NULL,
        "template_code" varchar(255) NOT NULL,
        "data" jsonb NOT NULL DEFAULT '{}',
        "idempotency_key" varchar(255) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'CREATED',
        "correlation_id" uuid NOT NULL,
        "event_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_notifications_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_notification_tenant_idempotency" UNIQUE ("tenant_id", "idempotency_key")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_tenant_status" ON "notifications" ("tenant_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_tenant_created" ON "notifications" ("tenant_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notifications"`);
  }
}
