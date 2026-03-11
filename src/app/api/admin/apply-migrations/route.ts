// Show migration SQL for manual application
import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    const migrations = [
      '20250301000003_fix_creator_invites.sql',
      '20250301000004_fix_storage_buckets.sql',
    ];

    const migrationContents = [];

    for (const migrationFile of migrations) {
      try {
        const migrationPath = join(process.cwd(), 'supabase', 'migrations', migrationFile);
        const sql = await readFile(migrationPath, 'utf-8');
        migrationContents.push({
          file: migrationFile,
          sql,
        });
      } catch (err: any) {
        migrationContents.push({
          file: migrationFile,
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      migrations: migrationContents,
      instructions: 'Copy the SQL from each migration and run it in your Supabase SQL Editor',
    });
  } catch (err: any) {
    return NextResponse.json({ 
      success: false, 
      error: err.message 
    }, { status: 500 });
  }
}
