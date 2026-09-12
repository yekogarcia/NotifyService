import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/notitify',
  entities: [path.join(__dirname, 'src', 'modules', '**', 'domain', 'entities', '*.entity.{ts,js}')],
  migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: false,
});
