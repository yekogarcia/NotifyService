import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeApplicationIdNullableInOauthTokens1726700000000
  implements MigrationInterface
{
  name = 'MakeApplicationIdNullableInOauthTokens1726700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "oauth_tokens" ALTER COLUMN "application_id" DROP NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "oauth_tokens" SET "application_id" = '00000000-0000-0000-0000-000000000000' WHERE "application_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "oauth_tokens" ALTER COLUMN "application_id" SET NOT NULL`,
    );
  }
}
