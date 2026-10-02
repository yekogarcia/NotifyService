import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFromEmailToTemplates1700000000027
  implements MigrationInterface
{
  name = 'AddFromEmailToTemplates1700000000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_templates" ADD COLUMN "from_email" varchar(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_templates" DROP COLUMN "from_email"`,
    );
  }
}
