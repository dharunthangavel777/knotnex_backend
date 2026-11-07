import fs from 'fs';
import path from 'path';
import { getClient, query } from '../config/database';
import { logger } from '../config/logger';

export const runMigrations = async () => {
  let client;
  const ADVISORY_LOCK_ID = 74219842;
  let lockAcquired = false;

  try {
    client = await getClient();
    logger.info('Acquiring migration lock and checking PostgreSQL schema state...');
    
    // Non-blocking try-lock prevents startup hangs across multiple Cloud Run instances
    const lockRes = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1) as acquired;',
      [ADVISORY_LOCK_ID]
    );
    lockAcquired = Boolean(lockRes.rows[0]?.acquired);

    if (!lockAcquired) {
      logger.info('Migration lock is currently held by another container/worker. Skipping redundant execution.');
      return { total: 0, newlyApplied: 0 };
    }

    // Set 30-second statement timeout for safety
    await client.query('SET statement_timeout = 30000;');

    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Fetch set of already executed migrations
    const res = await client.query<{ name: string }>('SELECT name FROM schema_migrations;');
    const appliedSet = new Set(res.rows.map(r => r.name));

    // 3. Resolve migrations directory (works in ts-node dev, docker, and compiled dist/)
    const candidateDirs = [
      path.resolve(__dirname, 'migrations'),
      path.resolve(__dirname, '../../src/db/migrations'),
      path.resolve(process.cwd(), 'src/db/migrations'),
      path.resolve(process.cwd(), 'dist/db/migrations'),
    ];

    const migrationsDir = candidateDirs.find(d => fs.existsSync(d) && fs.readdirSync(d).some(f => f.endsWith('.sql')));

    if (!migrationsDir) {
      logger.warn('No migrations directory found among candidates', { candidateDirs });
      return { total: appliedSet.size, newlyApplied: 0 };
    }

    const allFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    const pendingFiles = allFiles.filter(f => !appliedSet.has(f));

    if (pendingFiles.length === 0) {
      logger.info(`✨ Database schema is fully up to date (${allFiles.length}/${allFiles.length} migrations applied).`);
      return { total: allFiles.length, newlyApplied: 0 };
    }

    logger.info(`Found ${pendingFiles.length} pending migration(s) out of ${allFiles.length} total. Executing...`);

    // 4. Run each pending migration in its own transaction
    for (const file of pendingFiles) {
      logger.info(`⏳ Executing migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await client.query('BEGIN;');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1);', [file]);
        await client.query('COMMIT;');
        logger.info(`✅ Successfully applied migration: ${file}`);
      } catch (migrationErr: any) {
        await client.query('ROLLBACK;');
        logger.error(`❌ Migration failed on file ${file}. Rolled back transaction.`, {
          error: migrationErr.message,
        });
        throw migrationErr;
      }
    }

    logger.info(`🎉 All ${pendingFiles.length} pending migrations successfully applied.`);
    return { total: allFiles.length, newlyApplied: pendingFiles.length };
  } catch (error: any) {
    logger.error('PostgreSQL database migration process failed', { error: error.message });
    throw error;
  } finally {
    if (client) {
      if (lockAcquired) {
        try {
          await client.query('SELECT pg_advisory_unlock($1);', [ADVISORY_LOCK_ID]);
        } catch (unlockErr: any) {
          logger.warn('Failed to release advisory lock', { error: unlockErr.message });
        }
      }
      client.release();
    }
  }
};

export const runSeeds = async () => {
  try {
    logger.info('Running database seed script...');
    const candidateFiles = [
      path.resolve(__dirname, 'seeds/seed_dev_data.sql'),
      path.resolve(__dirname, '../../src/db/seeds/seed_dev_data.sql'),
      path.resolve(process.cwd(), 'src/db/seeds/seed_dev_data.sql'),
      path.resolve(process.cwd(), 'dist/db/seeds/seed_dev_data.sql'),
    ];

    const seedFile = candidateFiles.find(f => fs.existsSync(f));
    if (!seedFile) {
      logger.warn('Seed file not found.');
      return;
    }

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

