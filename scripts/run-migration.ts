import { runMigrations } from '../src/db/migrations';

async function main() {
  try {
    console.log('Running migrations...');
    await runMigrations();
    console.log('✅ Migrations complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();

