# SSOT v1.2 — FULL SINGLE SOURCE OF TRUTH

**Project:** Mobile multiplayer RPG (menu-driven) with deterministic, turn-based combat and per-character learning

**Status:** Locked for MVP execution (no guesswork). Any change requires an **SSOT Diff**.

---

## 0) Overview (Highly detailed, concisely worded)

### 0.1 Product Definition

A **mobile-first, menu-driven, multiplayer RPG** in an iron sci-fi dystopia dominated by AI overlords. Players control **one character**. The core differentiator is **progressively smarter combat behavior**: characters improve combat decisions through **deterministic, per-character learning** based on past battles.

### 0.2 Core Gameplay Loop

**Select node → server simulates 1v1 battle → client replays event log → gain EXP + materials → craft gear → equip loadout → repeat → trigger global milestones → global intel expands.**

### 0.3 World Model

The world is **persistent and shared**, but interaction is **menu-based** (no spatial movement). The world becomes more “known” through **global discoveries/milestones** (enemy archetypes, weaknesses, locations). Player progression remains personal (levels/gear/learning).

### 0.4 Combat Model

- **1v1 only**, **turn-based rounds** (max **30 rounds**).
- **Initiative accumulation** grants multiple actions per round for fast units.
- Loadout: **2 Active + 2 Passive** skills; AI chooses actions; player chooses loadout.
- **Statuses:** duration **1–3 turns**, **refresh-only**, no stacking.
- **Cooldowns:** **turn-based**.
- **Server authoritative**: server simulates and returns deterministic **BattleResult + BattleEvent log**; client replays only.
- **Integer-only arithmetic**. Accuracy/Evade are **basis points** (0–10,000). No floats anywhere.
- **SPD bounded globally** (no scaling). For MVP, SPD must remain in a safe range to prevent unreadable multi-action spam.

### 0.5 Learning Model (MVP)

- Learning is **per character only** (no global shared learned behavior).
- Learning is shown by **visible behavior change only** (no “inspect AI mind” UI).
- Learning adjusts **integer weights** used as bias in deterministic AI scoring, keyed by **(character, enemy archetype, active skill)**.
- Learning is stable, bounded, deterministic, and updated post-battle.

### 0.6 Content Budget (MVP)

- **10 enemy archetypes**
- **20 total skills** (recommended: **12 actives + 8 passives**)
- **30 craftable items**
- Skills unlocked by **level**; loadout can be changed **anytime outside combat**
- PvP is optional zones conceptually; **PvP uses same AI** and the same combat system. Full PvP balancing is post-MVP.

### 0.7 Success Metric

Target benchmark: **~1000 concurrent active online players**. Not required for MVP completion.

### 0.8 Tech Stack (LOCKED)

**Monorepo:** npm workspaces

**Backend:** Node.js + TypeScript + Express

**DB:** PostgreSQL + Prisma

**Client:** Next.js (TypeScript)

**Testing:** Jest (backend + shared)

**Shared Contract:** `packages/shared` is the only source for shared types and battle contract.

---

## 1) Non-Negotiables (Locks)

### 1.1 Combat Locks

- maxRounds = **30**
- All arithmetic **integer-only**
- `accuracyBP`, `evadeBP` in `[0..10_000]`
- Status duration in `{1,2,3}` turns; **refresh-only**; no stacking
- Cooldowns are **turn-based**
- No crits in MVP
- 1v1 only
- Loadout: **2 actives + 2 passives**
- AI chooses actions; player chooses loadout
- Server authoritative; client replays event log only

### 1.2 Scope Locks (MVP “NO” list)

- No movement / open-world walking
- No party combat / raids
- No strategy presets UI
- No skill marketplaces / intel trading
- No neural/ML learning
- No deep crafting trees
- No realtime multiplayer synchronization (menu-driven HTTP loop)

---

## 2) Combat Specification (Exact)

### 2.1 Round & Initiative Rule (implementation-ready)

Combat proceeds in rounds. Each round consists of:

1. **Initiative accumulation** (per combatant):
- `initiative = initiative + SPD`
1. **Action resolution loop**:
- While a combatant has `initiative >= 100`, they are eligible to act.
- When acting:
    - Choose action (AI).
    - Execute action.
    - `initiative = initiative - 100`
- Multiple actions per round are allowed if initiative remains `>=100`.
1. **Actor selection when both eligible** (deterministic ordering):
    
    Sort eligible combatants by:
    
- `initiative` **descending**
- `SPD` **descending**
- `entityId` **ascending**
1. **End of round**:
- Decrement all cooldowns by 1 (min 0).
- Decrement all status remainingTurns by 1; expire at 0.
- Proceed to next round.

### 2.2 Hit Chance (Integer BP)

Let:

- `A = clamp(actor.accuracyBP, 0, 10000)`
- `E = clamp(target.evadeBP, 0, 10000)`
- `SAcc = skill accuracy modifier BP` (recommended range `[-2000..+2000]`)

Then:

- `hitChanceBP = clamp(A - E + SAcc, 500, 9500)`
- `rollBP = rng.int(1..10000)`
- `hit = rollBP <= hitChanceBP`

### 2.3 Damage (Integer)

Let:

- `raw = skill.basePower + actor.ATK`
- `damage = floor(raw * 100 / (100 + target.DEF))`
- Optional: `damage = max(1, damage)` (MVP recommended)

For “ignore DEF%”:

- `effectiveDEF = floor(target.DEF * (100 - ignoreDefPct) / 100)`
- then compute mitigation with `effectiveDEF`.

### 2.4 Cooldowns (Turn-based)

- On use: `cooldownRemainingTurns = cooldownTurns`
- End of round: `cooldownRemainingTurns = max(0, cooldownRemainingTurns - 1)`

### 2.5 Statuses (Turn-based, Refresh-only)

- On apply:
    - If not present: add with durationTurns.
    - If already present: refresh duration to durationTurns (no stacking).
- End of round: decrement remainingTurns; remove at 0.

---

## 3) Loadout & Progression (Exact)

### 3.1 Loadout

- Equipped skills:
    - Actives: exactly **2**
    - Passives: exactly **2**
- Actives are the only selectable actions (plus Basic Attack).
- Passives are always-on modifiers (no action selection).

### 3.2 Skills Unlock

- Skills unlock by **level** (controlled progression).
- Equipping is allowed **anytime outside combat**.

### 3.3 Classes

- No character classes in MVP.
- Build identity comes from stats + equipped 2 actives + 2 passives + gear.

---

## 4) AI Decisioning (MVP)

### 4.1 Action Space (LOCKED)

Candidate actions each time the unit acts:

- `Basic Attack`
- `Active 1` (if cooldown==0)
- `Active 2` (if cooldown==0)

### 4.2 Inputs (Bounded)

AI can use:

- Self: HP%, statuses, cooldown readiness
- Enemy: HP%, statuses
- Enemy archetype + weaknesses **only if available via intel rules**
- Optional: last enemy action tag (if tracked)
- Must not use hidden enemy sheet unless intel allows it

### 4.3 Decision Method

Deterministic scoring. For each candidate action:

- base score
- 
    - matchup bonuses (execute threshold, shieldbreak, cleanse, anti-evasion)
- 
    - timing bonuses (e.g., execute when enemy HP% below threshold)
- − waste penalties (e.g., cleanse when no debuff)
- Pick max score (ties broken deterministically by skillId, then basic).
    - learned weight bias (per archetype per skill)
        
        Pick max score (ties broken deterministically by skillId, then basic).
        

No stochastic exploration in MVP.

---

## 5) Learning System (MVP)

### 5.1 What is learned

Per-character, per-enemy-archetype, per-active-skill:

- `weight_int ∈ [-1000..+1000]`

### 5.2 How learning updates

After battle, summarize usage per skill:

- `damageDealt` (int)
- `statusTurnsApplied` (int)
- `enemyHPMax` (int)
    
    Compute integer contribution:
    
- `damagePart = floor(damageDealt * 1000 / enemyHPMax)`
- `statusPart = floor(statusTurnsApplied * 1000 / 3)`
- `contrib = floor((700*damagePart + 300*statusPart) / 1000)`

Update (learningRate = **150**):

- `sign = win ? +1 : -1`
- `delta = floor(sign * learningRate * contrib / 1000)`
- `weight = clamp(weight + delta, -1000, +1000)`

### 5.3 How learning affects behavior

Weights are added as a bias term to the score of the corresponding active skill when fighting that archetype (when archetype is known/observed according to intel policy).

---

## 6) Shared Battle Contract (LOCKED)

### 6.1 Shared Types Location

`packages/shared` is the only source of:

- `BattleEvent`
- `BattleResult`
- id types (EntityId, SkillId, StatusId)

### 6.2 Battle Events (minimum required)

- ROUND_START / ROUND_END
- ACTION (includes `"basic"` or skillId)
- HIT_RESULT (includes hitChanceBP and rollBP for replay visibility/debug)
- DAMAGE (includes hpAfter)
- STATUS_APPLY / STATUS_REFRESH / STATUS_EXPIRE
- COOLDOWN_SET
- DEATH
- BATTLE_END (reason: death | timeout)

### 6.3 Determinism Contract

Given identical:

- seed
- initial snapshots
- content defs
    
    the server must generate identical event logs.
    

Client does not re-simulate outcomes.

---

## 7) World, Nodes, Milestones, Intel (MVP)

### 7.1 World Model

Persistent, shared, menu-driven world.

### 7.2 Nodes

Node types:

- Encounter node (spawns archetype)
- Resource node (materials-focused)
- Boss node (global milestone)

### 7.3 Global Milestones

Boss milestones are global and must be **race-safe**:

- unique constraint on milestone key
- first insertion wins; others no-op

### 7.4 Global Intel Policy (MVP)

Intel is **global and free**:

- discovered archetypes
- weakness tags
- unlocked locations/nodes
    
    No intel trading in MVP.
    

---

## 8) Crafting & Economy (MVP)

### 8.1 Materials

Limit to **6–8** materials total. Boss-only rare material allowed.

### 8.2 Crafting

- Recipes: 2–4 materials per item
- Shallow crafting tree
- Crafting validated server-side (no negative inventory)

### 8.3 Items

30 craftable items across:

- weapons / armor / utility
    
    Stats remain simple:
    
- HP, ATK, DEF, SPD (must respect global SPD bounds), accuracyBP, evadeBP

---

## 9) Module Architecture (Highly detailed, concisely worded)

**Each module is mapped from the Overview.**

### M1 — Client UX Shell (maps: Overview 0.1, 0.2, 0.6, 0.8)

Minimal Next.js UI implementing the core loop screens and navigation. No combat simulation.

### M2 — Backend API Gateway (maps: 0.2, 0.4, 0.6, 0.8)

Express API exposing character/world/combat/crafting endpoints. `/combat/start` is the authoritative resolution endpoint.

### M3 — Data Model & Persistence (maps: 0.1–0.6, 0.8)

Prisma schema + migrations for players, characters, inventory, learning weights, milestones, and content storage/versioning.

### M4 — World / Nodes / Milestones (maps: 0.3, 0.2, 0.6)

Node listing, entry, boss milestone writes, unlock rules.

### M5 — Combat Engine (maps: 0.4)

Deterministic round-based engine with initiative-based multi-actions, integer hit/damage, statuses, cooldowns.

### M6 — Battle Log Contract (maps: 0.4)

Shared BattleResult/BattleEvent types and constraints; engine must emit; client must consume.

### M7 — Client Battle Replay (maps: 0.4)

Replay engine that reduces events into UI state and animates; no simulation logic.

### M8 — AI Decisioning (maps: 0.5, 0.4)

Deterministic scoring over {basic, active1, active2} using heuristics + learned weights.

### M9 — Global Intel / Discoveries (maps: 0.3, 0.6)

Global discovery state surfaced via `/world/intel` and client Intel screen.

### M10 — Learning Persistence & Updates (maps: 0.5)

Summarize battle, update weights, persist transactionally with rewards.

### M11 — Content Authoring (maps: 0.6)

Seeded defs: 10 archetypes, 20 skills (12 actives/8 passives), statuses, items, recipes, nodes.

### M12 — Progression (maps: 0.6)

Level/exp rules; skill unlock schedule by level; stat growth constraints preserving SPD bounds.

### M13 — Crafting & Economy (maps: 0.6)

Materials, recipes, crafting endpoint, inventory effects on combat snapshots.

### M14 — Telemetry & Ops (maps: 0.7, 0.8)

Minimal correctness gates (tests + E2E). Optional runtime telemetry later.

---

## 10) Work Orders (WO) and Mapping (Everything included)

### Work Orders List (complete)

- **WO0** Monorepo scaffold + tooling (npm workspaces, TS configs, scripts)
- **WO1** Shared TypeScript contract (BattleEvent/BattleResult) in `packages/shared`
- **WO2** Deterministic RNG implementation + test
- **WO3** Battle engine emitting shared contract
- **WO4** AI decisioning
- **WO5** Learning summarization + weight update + persistence adapter
- **WO6** Content definitions + seeds (v1)
- **WO7** Prisma schema + migrations (Postgres)
- **WO8** Express API endpoints + combat transaction integration
- **WO9** World nodes + milestones + intel endpoints (race-safe)
- **WO10** Crafting + inventory integration
- **WO11** Next.js client UX shell
- **WO12** Client replay engine (event reducer + playback)
- **WO13** End-to-end integration slice (scripted happy path)
- **WO14** Jest test suite (determinism + ordering + status/cooldown invariants)

### Module → Work Orders Mapping (authoritative)

- **M1** → WO11, WO13
- **M2** → WO8, WO13
- **M3** → WO7, WO6 (seed strategy), WO13
- **M4** → WO9, WO6, WO13
- **M5** → WO3, WO2, WO1, WO14, WO13
- **M6** → WO1, WO3, WO12, WO14
- **M7** → WO12, WO11, WO13
- **M8** → WO4, (integrates with WO3), WO14 optional
- **M9** → WO9, WO6, WO8, WO11, WO13
- **M10** → WO5, WO7, WO8, WO14, WO13
- **M11** → WO6, WO7 optional, WO13
- **M12** → WO6, WO8, WO10, WO13
- **M13** → WO10, WO6, WO8, WO11, WO13
- **M14** → WO14, WO13

### Foundation Cross-Cutting

- **WO0 supports all modules**
- **WO1 supports M5/M6/M7/M2**
- **WO2 supports M5 + WO14**

---

## 11) Integration Contract (No drift)

### 11.1 `/combat/start` Transaction (must be atomic)

A single request must:

1. validate user + character + loadout (2 actives, 2 passives)
2. resolve node → enemy archetype
3. build combat snapshots (apply passives + items)
4. generate battleId + seed
5. simulate battle (WO3)
6. compute rewards + exp
7. update:
    - inventory
    - exp/level
    - world milestone (if boss)
    - learning weights
    - battle record (idempotency)
8. return `BattleResult` (shared) + rewards summary

### 11.2 Idempotency

Combat reward granting must not double-apply on retry:

- store `battleId` and enforce uniqueness

### 11.3 Client Replay

Client must:

- accept `BattleResult`
- replay `events` only
- never compute hit/damage locally

---

## 12) Repo Structure (LOCKED for agents)

```
repo/
  docs/SSOT.md
  docker-compose.yml
  apps/
    backend/
      prisma/
      src/
      test/
    client/
      src/
  packages/
    shared/
      src/
      test/
```

---

## 13) Execution Order (Step-by-step pipeline)

1. **WO0** repo scaffolding (npm workspaces)
2. **WO1** shared contract types
3. **WO7** Prisma schema + Postgres migrations + seed pipeline
4. **WO2** deterministic RNG + test
5. **WO3** battle engine + determinism tests (WO14 subset)
6. **WO6** minimal content seed v1 (start small, expand later)
7. **WO4 + WO5** AI + learning + tests
8. **WO8** API with `/combat/start` transaction integration
9. **WO9 + WO10** world + crafting integration
10. **WO11 + WO12** client shell + replay
11. **WO13** end-to-end integration script
12. **WO14** full test suite gate

---

## 14) Change Control (SSOT Diff Format)

Any change must be proposed as:

- **What changes** (exact section + wording)
- **Why**
- **Impact** (modules/work orders affected)
- **Migration plan** (if schema/contract changes)

No informal “just tweak it” changes.

---
