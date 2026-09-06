/**
 * Applies schema.sql to the database in DATABASE_URL, then seeds one business row
 * so you have a BUSINESS_ID to put in .env. Safe to re-run (schema uses IF NOT EXISTS
 * only implicitly via CREATE TABLE — drop tables manually if you need a clean slate).
 */
import 'dotenv/config';
import fs from 'fs';
import { pool } from './db.js';

async function migrate() {
  const sql = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  console.log('Schema applied.');

  const businessName = process.argv[2] || 'Test Business';
  const whatsappNumber = process.argv[3] || '0000000000';

  const { rows } = await pool.query(
    `INSERT INTO businesses (name, whatsapp_number) VALUES ($1, $2)
     ON CONFLICT (whatsapp_number) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [businessName, whatsappNumber]
  );
  console.log(`Business ready: id=${rows[0].id}, name="${rows[0].name}" — put this id in .env as BUSINESS_ID.`);

  await pool.end();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
