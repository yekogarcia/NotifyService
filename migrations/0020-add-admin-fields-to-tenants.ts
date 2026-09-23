import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminFieldsToTenants1700000000020 implements MigrationInterface {
  name = 'AddAdminFieldsToTenants1700000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN "email" varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN "password" varchar(500)`,
    );
    await queryRunner.query(
      `UPDATE "tenants" SET "email" = CONCAT("slug", '@admin.local'), "password" = '$argon2id$v=19$m=65536,t=3,p=4$placeholder$placeholder' WHERE "email" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ALTER COLUMN "email" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ALTER COLUMN "password" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD CONSTRAINT "uq_tenants_email" UNIQUE ("email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" DROP CONSTRAINT IF EXISTS "uq_tenants_email"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "password"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "email"`);
  }
}
