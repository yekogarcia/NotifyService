import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOauthTokens1700000000021 implements MigrationInterface {
  name = 'CreateOauthTokens1700000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "oauth_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "application_id" uuid NOT NULL,
        "user_id" varchar(255),
        "refresh_token" varchar(500) NOT NULL,
        "grant_type" varchar(50) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_oauth_tokens_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_oauth_tokens_application" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_oauth_tokens_refresh_token" ON "oauth_tokens" ("refresh_token")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_oauth_tokens_tenant_id" ON "oauth_tokens" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_oauth_tokens_application_id" ON "oauth_tokens" ("application_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_oauth_tokens_application_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_oauth_tokens_tenant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_oauth_tokens_refresh_token"`);
    await queryRunner.query(`DROP TABLE "oauth_tokens"`);
  }
}
