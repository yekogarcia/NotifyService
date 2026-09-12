import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationProviders1700000000008 implements MigrationInterface {
  name = 'CreateNotificationProviders1700000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "notification_providers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "provider_type" varchar(50) NOT NULL,
        "config" jsonb NOT NULL DEFAULT '{}',
        "secret_ref" varchar(255) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_providers_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_provider_tenant_type" ON "notification_providers" ("tenant_id", "provider_type")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notification_providers"`);
  }
}
