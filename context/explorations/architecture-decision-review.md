# Architecture Decision Review (Sanity Check)

Related: [[architecture-api]], [[state-management]], [[state-broadcasting]]

**Status:** Pre-implementation validation
**Date:** January 2025

---

## Purpose

Before building Agor, let's sanity-check all major architectural decisions to ensure we're not missing better alternatives or making flawed assumptions.

---

## Decision 1: FeathersJS for API Layer

### Current Decision (from architecture-api.md)

**Chosen:** FeathersJS + Drizzle ORM + LibSQL/PostgreSQL

**Reasoning:**
- REST + WebSocket from single service definition
- Built-in real-time with Socket.io
- Service hooks for validation/auth
- Works for V1 (local) and V2 (cloud)

### ⚠️ Critical Concerns

#### 1. **No Official Drizzle Adapter**

**Finding (Jan 2025):**
- ❌ No `feathers-drizzle` package exists
- ✅ Existing adapters: Sequelize, Objection, Knex, TypeORM
- ⚠️ **We'd need to build custom adapter**

**Impact:**
- Initial development overhead (1-2 weeks)
- Need to maintain adapter ourselves
- Risk of bugs in adapter layer

**Mitigation:**
- Use existing adapters as reference (feathers-objection, feathers-sequelize)
- Drizzle is simple - adapter should be straightforward
- Could contribute back to ecosystem

**Alternative:**
- Use FeathersJS with Knex adapter, skip Drizzle
- **Downside:** Knex less type-safe than Drizzle

---

#### 2. **FeathersJS Maintenance Concerns**

**Research (Jan 2025):**
- ✅ **Active:** Latest release Feb 2025 (feathers-chat updated)
- ✅ Ecosystem repos updated Jan 2025
- ⚠️ Smaller community than NestJS or Express
- ✅ Feathers v5 ("Dove") is stable

**Community Size:**
- FeathersJS GitHub: ~15k stars
- NestJS GitHub: ~68k stars
- Express GitHub: ~65k stars

**Risk Assessment:**
- 🟡 **Medium risk** - smaller community, but actively maintained
- Fewer tutorials/examples than NestJS
- Smaller plugin ecosystem

**Mitigation:**
- FeathersJS is stable and well-documented
- Real-time features are core (not bolted-on like NestJS)
- Can migrate to NestJS later if needed (services abstract DB layer)

---

### Alternative 1: NestJS + Socket.IO

**Pros:**
✅ Larger community, more examples
✅ Enterprise-proven architecture
✅ Better TypeScript DI patterns
✅ More plugins available
✅ Better for teams (opinionated structure)

**Cons:**
❌ No unified REST+WebSocket (need separate setup)
❌ More boilerplate (modules, controllers, services)
❌ Heavier (~enterprise-scale for local daemon)
❌ Steeper learning curve

**Example NestJS Setup:**
```typescript
// Need separate REST + WebSocket setup
@Controller('sessions')
export class SessionsController {
  @Get()
  async findAll() { /* REST */ }
}

@WebSocketGateway()
export class SessionsGateway {
  @SubscribeMessage('session:created')
  handleCreate() { /* WebSocket */ }
}
```

vs FeathersJS:
```typescript
// Single service = REST + WebSocket
class SessionsService {
  async find() { /* works for both */ }
}
// Auto-emits 'created' event via WebSocket
```

**Verdict:** FeathersJS wins for **less boilerplate** and **unified real-time**.

---

### Alternative 2: tRPC + Custom WebSocket

**Pros:**
✅ **Best type safety** - end-to-end TypeScript
✅ No code generation
✅ Client/server share types via monorepo
✅ Modern, growing ecosystem
✅ Great DX (developer experience)

**Cons:**
❌ **No built-in WebSocket real-time**
❌ Need separate WebSocket layer for live updates
❌ Requires monorepo (client + server in same repo)
❌ Less mature for production apps

**Example:**
```typescript
// tRPC router
const appRouter = router({
  sessions: {
    list: publicProcedure.query(async () => {
      return await db.sessions.findMany();
    }),
    create: publicProcedure
      .input(z.object({ prompt: z.string() }))
      .mutation(async ({ input }) => {
        return await db.sessions.create(input);
      })
  }
});

// Client gets full type safety
const sessions = await trpc.sessions.list.query();
//    ^? Session[]
```

**Real-time challenge:**
```typescript
// Need separate WebSocket server for live updates
const wss = new WebSocketServer();
wss.on('connection', (ws) => {
  // Manual broadcast logic
});
```

**Verdict:**
- 🟢 **Consider tRPC** if type safety is top priority
- 🔴 **Avoid** if real-time is core (need manual WebSocket layer)

---

### Alternative 3: Express + Socket.IO (Minimal)

**Pros:**
✅ Maximum flexibility
✅ Smallest footprint
✅ Most examples/resources
✅ No framework lock-in

**Cons:**
❌ **All manual** - routes, validation, auth, DB layer
❌ No structure (can be messy)
❌ Need to build REST conventions ourselves
❌ More boilerplate than FeathersJS/NestJS

**Example:**
```typescript
// Manual REST endpoints
app.get('/sessions', async (req, res) => {
  const sessions = await db.query.sessions.findMany();
  res.json(sessions);
});

app.post('/sessions', async (req, res) => {
  const session = await db.insert(sessions).values(req.body);

  // Manual WebSocket broadcast
  io.emit('session:created', session);

  res.json(session);
});
```

**Verdict:** Too manual for Agor's complexity.

---

### Alternative 4: Hono (Ultrafast, Edge-Ready)

**Pros:**
✅ **Blazing fast** (fastest Node.js framework)
✅ Works on edge (Cloudflare Workers, Deno, Bun)
✅ Tiny bundle size
✅ Modern API design

**Cons:**
❌ **No built-in WebSocket real-time**
❌ No ORM integrations
❌ Very new ecosystem
❌ Need to build everything ourselves

**Verdict:** Great for edge APIs, **overkill for local daemon**.

---

## Comparison Matrix

| Feature | Feathers | NestJS | tRPC | Express | Hono |
|---------|----------|--------|------|---------|------|
| **REST + WebSocket unified** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |
| **Type safety** | 🟡 Good | ✅ Great | ✅ Best | ❌ Manual | 🟡 Good |
| **Real-time built-in** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |
| **Boilerplate** | 🟢 Low | 🟡 Medium | 🟢 Low | 🔴 High | 🟢 Low |
| **Community size** | 🟡 15k | ✅ 68k | 🟢 35k | ✅ 65k | 🟡 New |
| **Local daemon fit** | ✅ Perfect | 🟡 Overkill | 🟢 Good | 🟡 Manual | 🟡 Overkill |
| **Drizzle support** | ⚠️ Custom | ✅ Native | ✅ Native | ✅ Native | ✅ Native |
| **Learning curve** | 🟢 Low | 🔴 High | 🟢 Low | 🟢 Low | 🟢 Low |

---

## Decision 2: Drizzle ORM

### Current Decision

**Chosen:** Drizzle ORM

**Reasoning:**
- Type-safe, SQL-like queries
- Lightweight
- LibSQL support
- PostgreSQL migration path

### Alternatives

**Prisma:**
- ✅ Great DX, studio UI
- ❌ Heavier (client generation)
- ❌ No LibSQL support (yet)

**Kysely:**
- ✅ Type-safe query builder
- ✅ Lightweight
- ❌ More verbose than Drizzle

**TypeORM:**
- ❌ Heavier, Active Record pattern
- ❌ Less modern than Drizzle

**Verdict:** ✅ **Drizzle is correct choice**

---

## Decision 3: LibSQL for V1

### Current Decision

**Chosen:** LibSQL (embedded SQLite fork by Turso)

**Reasoning:**
- Local-first (file-based)
- No server needed
- Turso provides cloud sync path

### ⚠️ Concern: Local-First Sync Complexity

**For V2 (cloud sync), we have options:**

#### Option A: Turso Embedded Replicas
```typescript
import { createClient } from '@libsql/client';

const db = createClient({
  url: 'file:~/.agor/sessions.db',
  syncUrl: 'https://agor-cloud.turso.io', // Cloud sync
  syncInterval: 60 // seconds
});
```

**Pros:**
✅ Built-in sync (LibSQL → Turso cloud)
✅ Simple setup

**Cons:**
❌ Vendor lock-in (Turso)
❌ Sync is eventual (not real-time)

---

#### Option B: FeathersJS Sync (Custom)
```typescript
// Local session creates → broadcast to cloud via Feathers
localClient.service('sessions').on('created', (session) => {
  cloudClient.service('sessions').create(session);
});
```

**Pros:**
✅ No vendor lock-in
✅ Full control

**Cons:**
❌ Complex conflict resolution
❌ Need to build sync ourselves

---

#### Option C: ElectricSQL (Postgres ↔ SQLite Sync)

**What is ElectricSQL?**
- Bidirectional sync: Postgres ↔ SQLite
- Real-time sync engine
- Local-first architecture

**Pros:**
✅ True local-first (Postgres for cloud, SQLite local)
✅ Real-time sync (better than Turso)
✅ Open source

**Cons:**
❌ **Still in alpha** (not production-ready)
❌ Complex setup
❌ Adds another layer

**Verdict:** 🟡 Monitor ElectricSQL for V2, **not ready for V1**.

---

#### Option D: Just Use PostgreSQL Everywhere

**Simplest approach:**
- V1: Local PostgreSQL instance
- V2: Hosted PostgreSQL (Supabase, Railway)

**Pros:**
✅ No sync complexity
✅ Same DB for local + cloud
✅ Well-understood

**Cons:**
❌ Requires PostgreSQL install (heavier than SQLite)
❌ Not truly "local-first" (need DB server running)

**Verdict:** 🟡 Viable if LibSQL sync proves too complex.

---

## Decision 4: Local Daemon Pattern

### Current Decision

**Chosen:** CLI/GUI → Auto-start Feathers daemon → LibSQL

**Reasoning:**
- Consistent API (local = cloud)
- No DB drivers in CLI/GUI
- Business logic in one place

### ⚠️ Concern: Daemon Lifecycle

**Questions:**
1. When does daemon shut down? (Never? On last client disconnect?)
2. How to handle daemon crashes?
3. How to upgrade daemon while running?

**Current approach (from architecture-api.md):**
```typescript
const daemon = spawn('agor-daemon', ['--port', '3030'], {
  detached: true,
  stdio: 'ignore',
});
daemon.unref(); // Don't wait for daemon
```

**Issues:**
- ❌ Daemon keeps running forever (process leak)
- ❌ No graceful shutdown
- ❌ No upgrade path

**Better approach:**
```typescript
// Track client connections
let activeClients = 0;

app.on('connection', () => activeClients++);
app.on('disconnect', () => {
  activeClients--;
  if (activeClients === 0) {
    setTimeout(() => {
      if (activeClients === 0) {
        // Shutdown after 5 min idle
        process.exit(0);
      }
    }, 5 * 60 * 1000);
  }
});
```

**Upgrade strategy:**
```bash
# CLI checks daemon version
$ agor session start
# Daemon v1.0.0 running, CLI is v1.1.0
# Warning: Daemon outdated, restart recommended
# Run: agor daemon restart
```

---

## Alternative: No Daemon (Direct DB Access)

**What if CLI/GUI accessed LibSQL directly?**

```typescript
// CLI directly uses Drizzle
import { drizzle } from 'drizzle-orm/libsql';
const db = drizzle('~/.agor/sessions.db');

const session = await db.insert(sessions).values({...});
```

**Pros:**
✅ Simpler (no daemon lifecycle)
✅ Faster (no HTTP overhead)
✅ No network layer needed

**Cons:**
❌ **No real-time sync** between CLI/GUI
❌ DB logic duplicated in CLI + GUI
❌ No central auth/validation point
❌ Hard to migrate to cloud (V2)

**Verdict:** ❌ Daemon pattern is correct for Agor.

---

## Decision 5: Monorepo Structure

### Current Decision

**Chosen:** Turborepo + pnpm

**Structure:**
```
agor/
├── apps/
│   ├── agor-daemon/
│   ├── agor-cli/
│   ├── agor-ui/
│   └── agor-desktop/
└── packages/
    ├── types/
    ├── feathers-client/
    └── drizzle-schema/
```

**Reasoning:**
- Share types between CLI/UI/daemon
- Shared Feathers client
- Shared Drizzle schema

### Alternatives

**Separate Repos:**
- ❌ Type sharing is painful
- ❌ Need to publish packages to npm
- ❌ Version skew issues

**Verdict:** ✅ **Monorepo is correct**

---

## Recommended Changes

### 1. **Validate FeathersJS + Drizzle Integration**

**Action before building:**
- [ ] Prototype custom Drizzle adapter for FeathersJS
- [ ] Ensure CRUD + hooks work correctly
- [ ] Validate real-time events fire properly

**Timeline:** 2-3 days

**If adapter is too complex:**
- Fallback to Feathers + Knex
- Or consider NestJS + Drizzle (more boilerplate, but proven)

---

### 2. **Defer Cloud Sync Decision**

**Current plan:** LibSQL + Turso sync for V2

**Recommendation:**
- ✅ Build V1 with LibSQL (local-only)
- ⏸️ **Defer V2 sync strategy** until V1 works
- 🔬 Monitor: ElectricSQL, Turso embedded replicas, custom Feathers sync

**Why:**
- V2 is 6+ months away
- Sync landscape is evolving (ElectricSQL alpha, Turso improving)
- Can evaluate options when V2 starts

---

### 3. **Add Daemon Lifecycle Management**

**Improvements needed:**
```typescript
// Auto-shutdown on idle
// Version mismatch detection
// Graceful restart command
// Health check endpoint
// Log rotation
```

**Timeline:** Add to Phase 1 implementation

---

### 4. **Consider tRPC for Type Safety**

**Hybrid approach:**
```typescript
// Use FeathersJS for real-time
// Use tRPC for type-safe mutations?
```

**Alternative:**
- Generate TypeScript types from Feathers services
- Use Zod for runtime validation + type inference

**Recommendation:** Stick with Feathers, add Zod validation.

---

## Final Verdict: Proceed with Current Architecture?

### ✅ **YES, with modifications:**

**Keep:**
1. ✅ **FeathersJS** - Best fit for unified REST + WebSocket
2. ✅ **Drizzle ORM** - Type-safe, lightweight
3. ✅ **LibSQL V1** - Local-first, simple
4. ✅ **Daemon pattern** - Right for multi-client sync
5. ✅ **Turborepo** - Monorepo is essential

**Add/Change:**
1. ⚠️ **Prototype Drizzle adapter first** (2-3 days)
2. ⚠️ **Improve daemon lifecycle** (auto-shutdown, version checks)
3. ⚠️ **Defer V2 sync decision** (evaluate options in 6 months)
4. ✅ **Add Zod validation** (type safety + runtime checks)

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Drizzle adapter is complex** | 🟡 Medium | Build prototype first; fallback to Knex if needed |
| **FeathersJS community small** | 🟡 Medium | Framework is stable; can migrate to NestJS if needed |
| **Daemon process leaks** | 🟡 Medium | Add auto-shutdown + health monitoring |
| **LibSQL sync is hard** | 🟢 Low | Defer to V2; evaluate ElectricSQL/Turso later |
| **Type safety gaps** | 🟢 Low | Add Zod validation + generate types from schemas |

---

## Action Plan

### Before Starting Implementation:

**Week -1: Validation Sprint**
- [ ] Day 1-2: Build FeathersJS + Drizzle adapter prototype
- [ ] Day 3: Test CRUD operations + real-time events
- [ ] Day 4: Evaluate complexity, decide on fallback
- [ ] Day 5: Document adapter approach or switch to Knex

**Decision point:** Proceed with Feathers if adapter works smoothly.

### Phase 1: MVP (Weeks 1-4)
- [ ] Feathers server + Drizzle (with validated adapter)
- [ ] Basic services (Sessions, Tasks, Boards)
- [ ] CLI with daemon auto-start + lifecycle
- [ ] UI with real-time hooks
- [ ] Zod validation throughout

### Phase 2: Polish (Weeks 5-8)
- [ ] Daemon health monitoring
- [ ] Auto-shutdown on idle
- [ ] Version mismatch warnings
- [ ] Error handling + logging

### Phase 3: V2 Planning (Month 3+)
- [ ] Evaluate ElectricSQL stability
- [ ] Test Turso embedded replicas
- [ ] Benchmark custom Feathers sync
- [ ] Choose V2 sync strategy

---

## Open Questions for Discussion

1. **FeathersJS vs NestJS:** Are we comfortable with smaller community?
   - **Lean:** Feathers (simpler, real-time built-in)
   - **Enterprise:** NestJS (proven, larger community)

2. **Drizzle adapter:** Build custom or switch to Knex?
   - **Recommendation:** Prototype first, decide based on complexity

3. **Daemon auto-shutdown:** Should it shutdown when idle?
   - **Recommendation:** Yes, after 5 min idle (configurable)

4. **Type safety:** Stick with Feathers or explore tRPC hybrid?
   - **Recommendation:** Feathers + Zod is sufficient

5. **V2 sync:** Turso, ElectricSQL, or custom?
   - **Recommendation:** Defer decision until V2 (6+ months)

---

## Conclusion

**Current architecture is sound with minor adjustments.**

The biggest risk is the **custom Drizzle adapter for FeathersJS**. We should:
1. Build prototype first (2-3 days)
2. Validate it works for our use case
3. Have fallback plan (Knex or NestJS)

Otherwise, the stack is well-chosen for Agor's requirements:
- ✅ Local-first (LibSQL)
- ✅ Real-time (FeathersJS WebSocket)
- ✅ Type-safe (Drizzle + TypeScript)
- ✅ Multi-client (daemon pattern)
- ✅ Cloud-ready (same API for V2)

**Recommendation: Proceed with validation sprint, then build.**

---

**Related Documents:**
- [[architecture-api]] - Full stack architecture
- [[state-management]] - Drizzle + LibSQL details
- [[state-broadcasting]] - Real-time sync strategy
