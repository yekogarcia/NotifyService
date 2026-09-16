import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';

const rootDir = process.cwd();

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/notifications',
  entities: [path.join(rootDir, 'src', 'modules', '**', 'domain', 'entities', '*.entity.{ts,js}')],
  migrations: [path.join(rootDir, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: false,
});
