# Async Jobs & Long-Running Operations

**Status:** Exploration
**Created:** 2025-10-06
**Context:** Session creation, repo cloning, and worktree setup can take 10s+ for large repos

## Problem Statement

Several Agor operations are long-running and blocking:

### Current Long-Running Operations

1. **Session Creation with New Repo**
   - Clone git repository (can be GBs, take minutes)
   - Create initial worktree
   - Initialize database records
   - **Current UX:** Blocks UI with loading spinner

2. **Session Creation with New Worktree**
   - Create git worktree from existing repo
   - Checkout branch/commit
   - Initialize session database record
   - **Current UX:** ~5-30s spinner

3. **Claude Code Session Import** (`agor session load-claude`)
   - Parse JSONL transcript (can be 100k+ lines)
   - Extract tasks from messages
   - Bulk insert 1000s of messages (batched at 100)
   - Bulk insert 100s of tasks (batched at 100)
   - **Current UX:** CLI progress output, ~10-60s

4. **Future: Report Generation**
   - Analyze session messages and tool uses
   - Generate markdown reports with code snippets
   - Potentially run LLM summarization
   - **Expected:** 30s - 5min depending on session size

5. **Future: Multi-Session Operations**
   - Bulk session imports from Claude Code projects
   - Session tree traversal and analysis
   - Cross-session concept extraction

## Current Approach

**Synchronous HTTP/WebSocket requests with client-side loading states**

### CLI

```typescript
// Current: Synchronous with progress logging
this.log(chalk.dim('Cloning repository...'));
await client.service('repos').create({ remote_url });
this.log(chalk.green('✓ Repository cloned'));
```

### UI

```typescript
// Current: Loading spinner blocks entire modal
const [loading, setLoading] = useState(false);
const handleCreate = async () => {
  setLoading(true);
  await createSession(config); // Can take 30s+
  setLoading(false);
};
```

**Issues:**

- ❌ HTTP request timeout (default 30s in most frameworks)
- ❌ No progress updates during operation
- ❌ Browser tab must stay open
- ❌ No retry/resume on failure
- ❌ Blocks daemon from handling other requests

## Architecture Options

### Option 1: Background Jobs with Status Polling (Recommended for MVP)

**Pattern:** Job queue + polling for status updates

```typescript
// 1. Client submits job
const job = await client.service('jobs').create({
  type: 'create-session',
  config: {
    /* session config */
  },
});

// 2. Poll for job status
const poller = setInterval(async () => {
  const status = await client.service('jobs').get(job.job_id);

  if (status.status === 'completed') {
    clearInterval(poller);
    onSuccess(status.result);
  } else if (status.status === 'failed') {
    clearInterval(poller);
    onError(status.error);
  } else {
    // Update progress UI
    updateProgress(status.progress);
  }
}, 1000);

// 3. Job runs in background
async function processJob(job) {
  await updateJobStatus(job.job_id, 'running', { progress: 0 });

  // Clone repo
  await cloneRepo(job.config.gitUrl);
  await updateJobStatus(job.job_id, 'running', { progress: 50 });

  // Create worktree
  await createWorktree(job.config.worktreeName);
  await updateJobStatus(job.job_id, 'running', { progress: 75 });

  // Create session
  const session = await createSession(job.config);
  await updateJobStatus(job.job_id, 'completed', { result: session });
}
```

**Implementation:**

- Add `jobs` table with `job_id`, `type`, `status`, `progress`, `result`, `error`
- Add `/jobs` FeathersJS service
- Add background worker (simple Node.js event loop or `node-cron`)
- WebSocket events for job progress: `jobs.patched` → update UI

**Pros:**

- ✅ Simple to implement with existing FeathersJS + Drizzle
- ✅ Works with current tech stack
- ✅ No additional dependencies
- ✅ Progress updates via WebSocket
- ✅ Client can reconnect and resume polling

**Cons:**

- ❌ Polling overhead (can mitigate with exponential backoff)
- ❌ Jobs lost on daemon restart (can persist to DB)
- ❌ No distributed workers (fine for single-user local daemon)

### Option 2: WebSocket Streaming with Server-Sent Progress

**Pattern:** Long-lived WebSocket connection with progress events

```typescript
// Client subscribes to job stream
const jobStream = client.service('sessions').create({
  mode: 'stream',
  config: {
    /* session config */
  },
});

jobStream.on('progress', event => {
  // { stage: 'cloning', percent: 45, message: 'Cloning repository...' }
  updateProgress(event);
});

jobStream.on('completed', session => {
  onSuccess(session);
});

jobStream.on('error', error => {
  onError(error);
});
```

**Implementation:**

- Extend FeathersJS services with streaming support
- Emit progress events during long operations
- Client handles real-time updates

**Pros:**

- ✅ Real-time progress updates
- ✅ No polling overhead
- ✅ Natural fit with FeathersJS WebSocket architecture

**Cons:**

- ❌ Connection must stay alive (client can't disconnect and resume)
- ❌ More complex error handling (connection drops)
- ❌ Doesn't persist job state for restarts

### Option 3: BullMQ / Redis Queue (Production Scale)

**Pattern:** Distributed job queue with Redis backend

```typescript
import { Queue, Worker } from 'bullmq';

// Add job to queue
const sessionQueue = new Queue('sessions', { connection: redisConfig });
const job = await sessionQueue.add('create', sessionConfig);

// Worker processes jobs
const worker = new Worker(
  'sessions',
  async job => {
    await job.updateProgress(0);
    await cloneRepo(job.data.gitUrl);
    await job.updateProgress(50);
    // ...
  },
  { connection: redisConfig }
);

// Listen for progress
job.on('progress', progress => {
  console.log(`Job progress: ${progress}%`);
});
```

**Pros:**

- ✅ Production-grade job queue
- ✅ Distributed workers (horizontal scaling)
- ✅ Retry, rate limiting, job prioritization
- ✅ Persistent jobs (survive restarts)
- ✅ Job history and metrics

**Cons:**

- ❌ Requires Redis dependency
- ❌ Overkill for single-user local daemon
- ❌ More infrastructure complexity

### Option 4: GitHub Actions / External CI (For Specific Jobs)

**Pattern:** Offload heavy jobs to external runners

```typescript
// Trigger GitHub Action to clone large repo
await octokit.actions.createWorkflowDispatch({
  workflow_id: 'clone-repo.yml',
  inputs: { repo_url: 'https://github.com/large/repo' },
});

// Poll GitHub API for completion
// Download artifacts when done
```

**Use Cases:**

- Very large repo clones (>10GB)
- CPU-intensive report generation
- Multi-session batch imports

**Pros:**

- ✅ Offloads heavy work from user's machine
- ✅ Leverages existing CI infrastructure

**Cons:**

- ❌ Requires GitHub account + setup
- ❌ Network dependency
- ❌ Slower for small operations

## Recommendation: Phased Approach

### Phase 1: Inline with Progress (Current)

- Keep synchronous operations for MVP
- Add progress logging in CLI
- Show loading spinners in UI
- **Good enough for:** Worktree creation (<10s), small repo clones

### Phase 2: Background Jobs with Polling

- Implement `jobs` service + table
- Add simple Node.js worker loop
- WebSocket progress events
- **Unlocks:** Large repo clones, Claude session imports, report generation

### Phase 3: Enhanced Job System (Future)

- Job retry/resume on failure
- Job history and analytics
- Job cancellation
- **When needed:** Production deployment, multi-user scenarios

### Phase 4: Distributed Queue (If needed)

- Add BullMQ + Redis for horizontal scaling
- **Only if:** Supporting multi-tenant cloud deployment

## Implementation Guide (Phase 2)

### 1. Database Schema

```typescript
// packages/core/src/db/schema/jobs.ts
export const jobs = sqliteTable('jobs', {
  job_id: text('job_id').primaryKey(),
  type: text('type').notNull(), // 'create-session', 'clone-repo', 'import-transcript'
  status: text('status').notNull(), // 'pending', 'running', 'completed', 'failed'
  progress: integer('progress').default(0), // 0-100
  data: text('data', { mode: 'json' }), // Job input config
  result: text('result', { mode: 'json' }), // Job output
  error: text('error'), // Error message if failed
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
  started_at: integer('started_at', { mode: 'timestamp' }),
  completed_at: integer('completed_at', { mode: 'timestamp' }),
});
```

### 2. FeathersJS Service

```typescript
// apps/agor-daemon/src/services/jobs/jobs.service.ts
export class JobsService implements ServiceMethods<Job> {
  async create(data: CreateJobData) {
    const job = await jobsRepo.create({
      type: data.type,
      status: 'pending',
      data: data.config,
    });

    // Enqueue for processing
    jobQueue.push(job);

    return job;
  }

  async get(id: JobID) {
    return await jobsRepo.findById(id);
  }
}
```

### 3. Background Worker

```typescript
// apps/agor-daemon/src/workers/job-processor.ts
const jobQueue: Job[] = [];

async function processQueue() {
  while (true) {
    const job = jobQueue.shift();
    if (!job) {
      await sleep(1000);
      continue;
    }

    try {
      await updateJob(job.job_id, { status: 'running', started_at: new Date() });

      const result = await executeJob(job);

      await updateJob(job.job_id, {
        status: 'completed',
        result,
        completed_at: new Date(),
      });

      // Emit WebSocket event
      app.service('jobs').emit('patched', job);
    } catch (error) {
      await updateJob(job.job_id, {
        status: 'failed',
        error: error.message,
        completed_at: new Date(),
      });
    }
  }
}

processQueue(); // Start worker loop
```

### 4. UI Integration

```typescript
// apps/agor-ui/src/hooks/useJobProgress.ts
export function useJobProgress(jobId: string) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<JobStatus>('pending');

  useEffect(() => {
    const jobsService = client.service('jobs');

    const handleJobUpdate = (job: Job) => {
      if (job.job_id === jobId) {
        setProgress(job.progress || 0);
        setStatus(job.status);
      }
    };

    jobsService.on('patched', handleJobUpdate);

    return () => {
      jobsService.removeListener('patched', handleJobUpdate);
    };
  }, [jobId]);

  return { progress, status };
}
```

## Current Tech Stack Compatibility

**FeathersJS:**

- ✅ Built-in WebSocket support for real-time updates
- ✅ Service events (`created`, `patched`) perfect for job status
- ✅ Easy to add new `/jobs` service

**Drizzle + LibSQL:**

- ✅ Can persist jobs to SQLite
- ✅ Supports JSON columns for job data/result
- ✅ Fast queries for job status lookup

**React + Ant Design:**

- ✅ `<Progress />` component for progress bars
- ✅ `<Spin />` for loading states
- ✅ `message.loading()` for inline notifications

**Node.js:**

- ✅ Simple event loop for background worker
- ✅ No additional runtime needed
- ✅ Can use `setInterval()` or `while(true)` loop

## Next Steps

1. **Immediate:** Add progress logging to CLI session import
2. **Short-term:** Implement basic jobs table + service
3. **Medium-term:** Add background worker for session creation
4. **Long-term:** Enhanced job system with retry/resume

## References

- BullMQ: https://docs.bullmq.io/
- FeathersJS Real-time: https://feathersjs.com/api/events.html
- Job Queue Patterns: https://www.enterpriseintegrationpatterns.com/patterns/messaging/
