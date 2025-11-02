/**
 * Migration: Add parent_tool_use_id column to messages table
 *
 * Adds support for tracking nested tool calls (e.g., Task tool spawning Read/Grep operations).
 * The parent_tool_use_id field links child operations to their parent tool invocation.
 */

import type { Database } from '../client';

export async function migrate(db: Database): Promise<void> {
  console.log('Running migration: add parent_tool_use_id column to messages table');

  // Add the parent_tool_use_id column
  await db.run(`
    ALTER TABLE messages
    ADD COLUMN parent_tool_use_id TEXT;
  `);

  console.log('Migration complete: parent_tool_use_id column added');
}

export async function rollback(db: Database): Promise<void> {
  console.log('Rolling back migration: remove parent_tool_use_id column');

  // Note: SQLite doesn't support DROP COLUMN directly
  // Would need to recreate table without the column if rollback is needed
  throw new Error(
    'Rollback not supported for this migration. SQLite does not support DROP COLUMN.'
  );
}
