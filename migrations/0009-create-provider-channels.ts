import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProviderChannels1700000000009 implements MigrationInterface {
  name = 'CreateProviderChannels1700000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "notification_provider_channels" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "provider_id" uuid NOT NULL,
        "channel" varchar(20) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_pchannels_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_pchannels_provider" FOREIGN KEY ("provider_id") REFERENCES "notification_providers"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_active_provider_per_channel"
       ON "notification_provider_channels" ("tenant_id", "channel")
       WHERE "is_active" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_active_provider_per_channel"`);
    await queryRunner.query(`DROP TABLE "notification_provider_channels"`);
  }
}
