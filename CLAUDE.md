# CLAUDE.md - Dark-Lord (Demon Lord Defense Ritual)

## Project Overview

This is a Japanese-language browser-based tower defense / puzzle game called "Demon Lord Defense Ritual" (魔王の防衛儀式). Players combine bone/meat/spirit pieces in a match-3-like ritual grid to summon demon units that defend against waves of hero enemies.

**Stack**: React 18.2 + TypeScript 5.9 + Vite 7.3 + PixiJS 7.4 + GSAP 3.14
**Deployment**: GitHub Pages at `/Dark-Lord/`
**Language**: UI and all game text is in Japanese

---

## Repository Structure

```
Dark-Lord/
├── .github/workflows/deploy.yml  # GitHub Pages CI/CD (triggers on master push)
├── docs/
│   └── output/unit_stats.md      # Auto-generated unit balance reference (Japanese)
├── public/vite.svg
├── src/
│   ├── assets/react.svg
│   ├── components/
│   │   ├── BattlePhase.tsx       # Layout container (152 lines): left/right panels, scroll sync
│   │   ├── BestiaryModal.tsx     # Unit info modal with ability descriptions (453 lines)
│   │   ├── DebugPanel.tsx        # Debug tools for spawning/clearing (192 lines)
│   │   ├── DefensePhase.tsx      # Core tower defense engine using PixiJS (1971 lines)
│   │   ├── ErrorBoundary.tsx     # React error boundary (42 lines)
│   │   ├── ResponsiveWrapper.tsx # Canvas scaling to logical 1240x636 (172 lines)
│   │   ├── RitualPhase.tsx       # Match-3 puzzle grid, recipe matching (1278 lines)
│   │   └── UnitSprite.tsx        # Sprite rendering component (120 lines)
│   ├── contexts/
│   │   └── GameContext.tsx       # Global game state via React Context (489 lines)
│   ├── game/
│   │   ├── config.ts             # All game data: recipes, units, relics, colors
│   │   └── entities.ts           # TypeScript types: EntityState, PassiveAbility, stats
│   ├── App.tsx                   # Phase router: TITLE → RITUAL → BATTLE → RESULT
│   ├── App.css
│   ├── index.css
│   └── main.tsx                  # Entry point
├── index.html
├── eslint.config.js
├── package.json
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
└── vite.config.ts
```

---

## Development Workflows

### Setup & Running

```bash
npm install         # Install dependencies
npm run dev         # Start dev server (accessible on all interfaces)
npm run build       # TypeScript check + Vite production build → dist/
npm run lint        # ESLint (must pass before committing)
npm run preview     # Preview production build locally
```

### Deployment

Pushing to `master` automatically triggers `.github/workflows/deploy.yml`:
1. Builds with `npm ci && npm run build`
2. Deploys `dist/` to GitHub Pages

The Vite base path is `/Dark-Lord/` — all asset paths must account for this.

---

## Architecture & Key Conventions

### Game Phases (App.tsx)

State machine managed in `GameContext`:
```
TITLE → RITUAL (puzzle) → BATTLE (tower defense) → RESULT
```

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Unit/recipe IDs | `snake_case` | `skeleton_bone`, `lich_spirit` |
| React components | `PascalCase` | `BattlePhase`, `RitualPhase` |
| Functions/variables | `camelCase` | `summonedMonsters`, `addEquippedRecipe` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_AP`, `DEMON_SPEED`, `ROWS` |
| Types/interfaces | `PascalCase` | `EntityState`, `PassiveAbility`, `Recipe` |

### TypeScript Patterns

- Strict mode is enabled (`noUnusedLocals`, `noUnusedParameters`, `noImplicitAny`)
- Use **union string literals** for state types — avoid enums
  ```ts
  type GamePhase = 'TITLE' | 'RITUAL' | 'BATTLE' | 'RESULT';
  ```
- Use `Record<string, T>` for lookup maps
- Use `Partial<EntityState>` for optional override stats in `config.ts`
- No implicit `any` — always type function parameters and return values

### State Management

Global game state lives in `src/contexts/GameContext.tsx`. It manages:
- Phase transitions
- Recipe unlock/equip system
- Monster summoning queue
- Currency (money/AP)
- Relic ownership
- Ritual grid persistence between phases
- Enemy wave generation
- Roguelike battle option selection
- Debug mode toggle
- Shared PixiJS app reference

**Rule**: Component-local state (animations, hover, etc.) stays in components. Cross-phase or persistent state goes in GameContext.

### PixiJS Rendering

`DefensePhase.tsx` uses PixiJS directly for the battle canvas. Key points:
- The shared PixiJS app instance is passed via `GameContext` to synchronize canvas between `DefensePhase` and `RitualPhase`
- `ResponsiveWrapper.tsx` handles scaling: logical resolution is **1240×636**, scaled to fit the viewport
- Do not manipulate the PixiJS stage outside of `DefensePhase` and `ResponsiveWrapper`

### Performance Conventions

- Passive abilities are cached on entity objects (`passiveCache`) — don't recompute them each frame
- Damage text pool is capped at **30 items** max
- GSAP animations are used for puzzle piece effects (not CSS transitions)
- Keep PixiJS render loop lean — avoid closures that capture large state each tick

---

## Game Data Reference

### Materials

| Value | Japanese | English |
|-------|----------|---------|
| `0` | 骨 | Bone |
| `1` | 肉 | Meat |
| `2` | 霊 | Spirit |

### Recipe System (src/game/config.ts)

12 recipe templates (each handles 3 material variants via `resultMap: { 0: '_bone', 1: '_meat', 2: '_spirit' }`):
- **8 Common** (single-color wildcard shapes) → summons: Goblin (I3), Skeleton (L3), Archer (I4), Orc (O4), Lich (T4), Cerberus (L4), Imp (S4), Banshee (Z4)
- **4 Rare** (special shapes with wildcard/mixed slots) → summons: Wisp (diagonal 3), Necromancer, Minotaur, Ghoul

Shapes use a 9×9 grid system (`ROWS`, `COLS = 9`, block size `54px`).
Pattern values: `0`=骨, `1`=肉, `2`=霊, `9`=wildcard (❓), `-1`=empty.

### Units (src/game/entities.ts + src/game/config.ts)

- **24 demon unit variants** (8 common × 3 materials + 4 rare × 3 materials) each with: HP, ATK, range, speed, cooldown, size, color, passive abilities
- **1 token unit**: `zombie` (spawned by abilities, not by recipe)
- **11 hero types** (enemies)
- All demons use base speed modifier `DEMON_SPEED = 0.8`
- Unit stats are documented in `docs/output/unit_stats.md` with DPS calculations

### Passive Ability System

36 ability types defined in `entities.ts` (`PassiveAbility` union + `PASSIVE_DESCRIPTIONS` map):

```
REFLECT, AURA_REGEN, PIERCING, PIECE_RETURN, CLONE, AREA_DOT, ATK_BUFF, HEAL_SHOT,
SUMMON, CORPSE_EXPLOSION, PROXIMITY_EXPLOSION, INSTANT_AOE, BERSERK, SELF_REGEN,
LIFESTEAL, POISON, DOUBLE_SPAWN, ON_DEATH_SPAWN, UNTARGETABLE, RAPID_FIRE,
MACHINE_GUN, BOUNCE_SHOT, HEAL_AURA, AOE_ON_HIT, FRONTAL_AOE, EXPLODE_PROJECTILE,
EXPLODE_HEAL, CHARGE_EXPLOSION, ALLY_DEATH_EXPLOSION, ENEMY_DEATH_SPAWN,
CHARGE, KNOCKBACK, RANGED_RESIST, TARGET_LOWEST_HP, MOVE_REGEN, STEALTH
```

- Each ability has typed parameters: `{ value?, range?, cooldown? }`
- Abilities are cached per entity on spawn (see `passiveCache` pattern)

### Relics

4 purchasable relic effects defined in `config.ts`. Persistent across a run.

---

## What Not to Do

- **No test files exist** — do not add tests without discussing the testing strategy first
- **Do not change the base path** in `vite.config.ts` (`/Dark-Lord/`) — it is required for GitHub Pages
- **Do not add English UI text** — all player-facing strings must be in Japanese
- **Do not use enums** — use union string literal types instead
- **Do not add `any` types** — strict TypeScript is enforced by the compiler and linter
- **Do not add global CSS** beyond `index.css` and `App.css` — components use inline styles or scoped class names
- **Do not modify `DefensePhase.tsx` game loop logic** without understanding the full ability/projectile/collision pipeline — it is 1971 lines of tightly coupled state

---

## Common Tasks

### Adding a New Unit

1. Define stats in `src/game/entities.ts` (add to `UNIT_STATS` record)
2. Add recipes in `src/game/config.ts` (common or rare recipe entry)
3. Add ability descriptions to `BestiaryModal.tsx` if using new passive abilities
4. Update `docs/output/unit_stats.md` with balance notes

### Adding a New Passive Ability

1. Add the type to the `PassiveAbility` union in `entities.ts`
2. Add a description string to `PASSIVE_DESCRIPTIONS` in `entities.ts`
3. Implement the ability logic in `DefensePhase.tsx` (check existing ability handlers for pattern)

### Modifying Game Balance

- Unit stats: `src/game/config.ts` (stats object) and `src/game/entities.ts`
- Combo/timing: `RitualPhase.tsx` (combo acceleration constants, currently 20–40ms range)
- Enemy waves: `GameContext.tsx` (wave generation logic)

### Debug Mode

Toggle debug mode via the game UI or `GameContext`. The `DebugPanel.tsx` component provides:
- Manual enemy spawning
- Grid clearing utilities

---

## Build Artifacts

- `dist/` — production build output (gitignored)
- `node_modules/` — dependencies (gitignored)

The `docs/output/unit_stats.md` file is auto-generated (last updated 2026-03-28) and reflects the current balance state.

---

## Relic Reference (src/game/config.ts)

| ID | Japanese Name | Price | Effect |
|----|---------------|-------|--------|
| `giant_heart` | 巨人の心臓 | 80 | All demon HP ×2, move speed −30% |
| `fire_crown` | 炎の王冠 | 80 | Red unit ATK ×1.5, others ×0.8 |
| `mana_prism` | マナの水晶 | 60 | Base HP ÷2, gain magic effects |
| `necromancer_guide` | 死霊術師の手引き | 100 | 25% chance to spawn skeleton on enemy death |
