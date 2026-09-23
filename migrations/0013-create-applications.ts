import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateApplications1700000000013 implements MigrationInterface {
  name = 'CreateApplications1700000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "applications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "client_id" varchar(255) NOT NULL,
        "client_secret" varchar(500) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_applications_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_applications_client_id" ON "applications" ("client_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_applications_tenant_id" ON "applications" ("tenant_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_applications_tenant_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_applications_client_id"`);
    await queryRunner.query(`DROP TABLE "applications"`);
  }
}
