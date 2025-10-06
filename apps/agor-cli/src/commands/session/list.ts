/**
 * `agor session list` - List all sessions
 *
 * Displays sessions in a beautiful table with filters.
 */

import { createClient, isDaemonRunning } from '@agor/core/api';
import { formatShortId } from '@agor/core/db';
import type { Session } from '@agor/core/types';
import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import Table from 'cli-table3';

// Type for paginated responses
interface Paginated<T> {
  total: number;
  limit: number;
  skip: number;
  data: T[];
}

export default class SessionList extends Command {
  static description = 'List all sessions';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --status running',
    '<%= config.bin %> <%= command.id %> --agent claude-code',
    '<%= config.bin %> <%= command.id %> --board experiments',
  ];

  static flags = {
    status: Flags.string({
      char: 's',
      description: 'Filter by status',
      options: ['idle', 'running', 'completed', 'failed'],
    }),
    agent: Flags.string({
      char: 'a',
      description: 'Filter by agent',
      options: ['claude-code', 'cursor', 'codex', 'gemini'],
    }),
    board: Flags.string({
      char: 'b',
      description: 'Filter by board name or ID',
    }),
    limit: Flags.integer({
      char: 'l',
      description: 'Maximum number of sessions to show',
      default: 50,
    }),
  };

  /**
   * Format relative time (e.g., "2 mins ago")
   */
  private formatRelativeTime(isoDate: string): string {
    const now = Date.now();
    const date = new Date(isoDate).getTime();
    const diff = now - date;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  }

  /**
   * Format status with color
   */
  private formatStatus(status: Session['status']): string {
    const icons = {
      running: chalk.blue('●'),
      completed: chalk.green('✓'),
      failed: chalk.red('✗'),
      idle: chalk.gray('○'),
    };

    const labels = {
      running: chalk.blue('Running'),
      completed: chalk.green('Done'),
      failed: chalk.red('Failed'),
      idle: chalk.gray('Idle'),
    };

    return `${icons[status]} ${labels[status]}`;
  }

  /**
   * Truncate text to max length
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 3)}...`;
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(SessionList);

    // Check if daemon is running
    const daemonUrl = process.env.AGOR_DAEMON_URL || 'http://localhost:3030';
    const running = await isDaemonRunning(daemonUrl);

    if (!running) {
      this.error(
        `Daemon not running. Start it with: ${chalk.cyan('cd apps/agor-daemon && pnpm dev')}`
      );
    }

    try {
      // Connect to daemon
      const client = createClient(daemonUrl);

      // Build query
      interface QueryParams {
        $limit: number;
        $sort: { created_at: -1 };
        status?: string;
        agent?: string;
        board_id?: string;
      }

      const query: QueryParams = {
        $limit: flags.limit,
        $sort: { created_at: -1 }, // Most recent first
      };

      if (flags.status) query.status = flags.status;
      if (flags.agent) query.agent = flags.agent;
      if (flags.board) query.board_id = flags.board; // TODO: Support board name lookup

      // Fetch sessions
      const sessionsService = client.service('sessions');
      // biome-ignore lint/suspicious/noExplicitAny: Feathers service methods not properly typed
      const result = await (sessionsService as any).find({ query });
      const isPaginated = !Array.isArray(result);
      const sessions = Array.isArray(result) ? result : (result as Paginated<Session>).data;
      const total = isPaginated ? (result as Paginated<Session>).total : sessions.length;

      if (!Array.isArray(sessions) || sessions.length === 0) {
        this.log(chalk.dim('No sessions found.'));
        this.log('');
        this.log(`Create one with: ${chalk.cyan('agor session create')}`);
        return;
      }

      // Create table
      const table = new Table({
        head: [
          chalk.cyan('ID'),
          chalk.cyan('Description'),
          chalk.cyan('Agent'),
          chalk.cyan('Status'),
          chalk.cyan('Tasks'),
          chalk.cyan('Worktree'),
          chalk.cyan('Git Ref'),
          chalk.cyan('Modified'),
        ],
        style: {
          head: [],
          border: ['dim'],
        },
        colWidths: [10, 30, 13, 12, 8, 18, 15, 12],
      });

      // Add rows
      for (const session of sessions) {
        const shortId = formatShortId(session.session_id);
        const firstTask =
          Array.isArray(session.tasks) && session.tasks.length > 0 ? session.tasks[0] : null;
        const description = this.truncate(
          session.description ||
            (firstTask && 'full_prompt' in firstTask ? firstTask.full_prompt : '(no description)'),
          28
        );
        const taskCount = session.tasks?.length || 0;
        const completedTasks =
          session.tasks?.filter((t: { status: string }) => t.status === 'completed').length || 0;
        const worktree = session.repo?.worktree_name
          ? `${session.repo.repo_slug}:${session.repo.worktree_name}`
          : session.repo?.repo_slug || '-';
        const gitRef = session.git_state?.ref || '-';
        const modified = this.formatRelativeTime(session.last_updated || session.created_at);

        table.push([
          chalk.dim(shortId),
          description,
          session.agent,
          this.formatStatus(session.status),
          `${completedTasks}/${taskCount}`,
          chalk.dim(worktree),
          chalk.dim(gitRef),
          chalk.dim(modified),
        ]);
      }

      // Display
      this.log('');
      this.log(table.toString());
      this.log('');
      if (isPaginated && total > sessions.length) {
        this.log(chalk.dim(`Showing ${sessions.length} of ${total} session(s)`));
      } else {
        this.log(chalk.dim(`Showing ${sessions.length} session(s)`));
      }
      this.log('');

      // Close socket connection and wait for it to close
      await new Promise<void>(resolve => {
        client.io.on('disconnect', resolve);
        client.io.close();
        setTimeout(resolve, 1000); // Fallback timeout
      });
      process.exit(0);
    } catch (error) {
      this.error(
        `Failed to fetch sessions: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
