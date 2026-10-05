import { runSeeds } from '../src/db/migrate';

runSeeds()
  .then(() => {
    console.log('Seed data inserted successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
