import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApplicationIdToDevices1700000000018 implements MigrationInterface {
  name = 'AddApplicationIdToDevices1700000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_devices" ADD COLUMN "application_id" uuid`,
    );
    await queryRunner.query(
      `UPDATE "notification_devices" SET "application_id" = (SELECT id FROM "applications" LIMIT 1) WHERE "application_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_devices" ALTER COLUMN "application_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_devices" ADD CONSTRAINT "fk_devices_application" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_devices_application_id" ON "notification_devices" ("application_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_devices" DROP CONSTRAINT IF EXISTS "uq_devices_tenant_token"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_devices" ADD CONSTRAINT "uq_devices_tenant_app_token" UNIQUE ("tenant_id", "application_id", "device_token")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notification_devices" DROP CONSTRAINT IF EXISTS "uq_devices_tenant_app_token"`);
    await queryRunner.query(`ALTER TABLE "notification_devices" ADD CONSTRAINT "uq_devices_tenant_token" UNIQUE ("tenant_id", "device_token")`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_devices_application_id"`);
    await queryRunner.query(`ALTER TABLE "notification_devices" DROP CONSTRAINT IF EXISTS "fk_devices_application"`);
    await queryRunner.query(`ALTER TABLE "notification_devices" DROP COLUMN "application_id"`);
  }
}
