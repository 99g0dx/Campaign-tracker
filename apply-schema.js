#!/usr/bin/env node
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🔄 Applying database schema...');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✓ Set' : '✗ Not set');

try {
  console.log('\n📦 Running drizzle-kit push...');
  const { stdout, stderr } = await execAsync('npx drizzle-kit push', {
    env: process.env
  });

  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);

  console.log('\n✅ Schema applied successfully!');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Failed to apply schema:');
  console.error(error.message);
  if (error.stdout) console.log(error.stdout);
  if (error.stderr) console.error(error.stderr);
  process.exit(1);
}
