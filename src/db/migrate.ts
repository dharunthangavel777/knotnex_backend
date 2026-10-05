import fs from 'fs';
import path from 'path';
import { query } from '../config/database';
import { logger } from '../config/logger';

export const runMigrations = async () => {
  try {
    logger.info('Starting PostgreSQL schema migration...');
    const migrationsDir = path.resolve(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      logger.info(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await query(sql);
    }
    logger.info(`Database migration completed successfully. All ${files.length} migration files executed.`);
  } catch (error: any) {
    logger.error('Database migration failed', { error: error.message });
    throw error;
  }
};

export const runSeeds = async () => {
  try {
    logger.info('Running database seed script...');
    const seedFile = path.resolve(__dirname, 'seeds/seed_dev_data.sql');
    const sql = fs.readFileSync(seedFile, 'utf8');

    await query(sql);
    logger.info('Database seeding completed successfully.');
  } catch (error: any) {
    logger.error('Database seeding failed', { error: error.message });
    throw error;
  }
};

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
