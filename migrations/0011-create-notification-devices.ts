import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationDevices1700000000011 implements MigrationInterface {
  name = 'CreateNotificationDevices1700000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "notification_devices" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "user_id" varchar(255) NOT NULL,
        "device_token" varchar(500) NOT NULL,
        "platform" varchar(20) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_devices_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_devices_tenant_token" UNIQUE ("tenant_id", "device_token")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_devices_tenant_user" ON "notification_devices" ("tenant_id", "user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notification_devices"`);
  }
}
