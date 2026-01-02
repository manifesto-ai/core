# God's Desktop — Technical Specification

> **Version:** 0.1.0  
> **Status:** Draft  
> **Stack:** Next.js 14 + shadcn/ui + TailwindCSS + Manifesto  
> **Packages:** `@manifesto-ai/core`, `@manifesto-ai/world`, `@manifesto-ai/react`, `@manifesto-ai/host`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Domain Schema](#2-domain-schema)
3. [State Specification](#3-state-specification)
4. [Computed Specification](#4-computed-specification)
5. [Actions Specification](#5-actions-specification)
6. [Effect System](#6-effect-system)
7. [Zone System](#7-zone-system)
8. [LLM Integration](#8-llm-integration)
9. [UI Components](#9-ui-components)
10. [Timeline System](#10-timeline-system)

---

## 1. Architecture Overview

### 1.1 System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js Application                        │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐   │
│  │  Console  │ │   Grid    │ │ Inspector │ │   Timeline    │   │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └───────┬───────┘   │
│        └─────────────┴─────────────┴───────────────┘           │
│                              │                                  │
│                    @manifesto-ai/react                          │
│                              │                                  │
├──────────────────────────────┼──────────────────────────────────┤
│                    @manifesto-ai/bridge                         │
│                              │                                  │
├──────────────────────────────┼──────────────────────────────────┤
│                    @manifesto-ai/world                          │
│            (Proposal → Authority → Decision)                    │
│                              │                                  │
├──────────────────────────────┼──────────────────────────────────┤
│                    @manifesto-ai/host                           │
│         (Effect Execution, LLM Calls, UI Effects)               │
│                              │                                  │
├──────────────────────────────┼──────────────────────────────────┤
│                    @manifesto-ai/core                           │
│              (Pure Computation, MEL Evaluation)                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
User Input (Console)
       │
       ▼
┌─────────────────┐
│  Intent Parser  │ ← LLM Call (1회)
│   (GPT-4o-mini) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Bridge.dispatch│
│   (IntentBody)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  World.submit   │
│   (Proposal)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Core.compute   │ ← Pure, Deterministic
│   (MEL Eval)    │
└────────┬────────┘
         │
         ├──→ State Patches
         │
         └──→ Effect Requirements
                    │
                    ▼
           ┌─────────────────┐
           │  Host.execute   │
           │   (Effects)     │
           └────────┬────────┘
                    │
         ┌─────────┴─────────┐
         ▼                   ▼
   ┌──────────┐       ┌──────────┐
   │ UI Effect│       │LLM Effect│
   │ (Flash,  │       │(Hydrate, │
   │  Shake)  │       │ Response)│
   └──────────┘       └──────────┘
```

### 1.3 Cost Model

| Layer | Cost | Frequency |
|-------|------|-----------|
| Core.compute | $0 | Every tick |
| UI Effects | $0 | On trigger |
| Intent Parser | ~$0.001 | Per command |
| NPC Hydrate | ~$0.002 | Zone transition |
| Drama Response | ~$0.001 | Per trigger |
| Prophet Interpretation | ~$0.002 | Major events |

---

## 2. Domain Schema

### 2.1 MEL Domain Definition

```mel
domain GodsDesktop {
  
  // ═══════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════
  
  state {
    // Grid
    grid: { width: number, height: number } = { width: 20, height: 15 }
    
    // Time
    time: {
      tick: number,
      hour: number,
      day: number,
      weather: "clear" | "rain" | "storm" | "fog"
    } = { tick: 0, hour: 6, day: 1, weather: "clear" }
    
    // Player (God's Cursor)
    player: { x: number, y: number } = { x: 10, y: 7 }
    
    // NPCs
    npcs: Record<string, NpcState> = {}
    
    // Divine Systems
    reputation: { fear: number, mercy: number } = { fear: 0, mercy: 0 }
    prayerQueue: Array<Prayer> = []
    
    // UI State
    console: {
      history: Array<ConsoleLine>,
      pending: string | null
    } = { history: [], pending: null }
    
    // Selected entity for Inspector
    selectedNpcId: string | null = null
    
    // Effect Queue (UI reads this)
    effectQueue: Array<UIEffect> = []
    
    // Timeline
    timeline: {
      snapshots: Record<string, TimelineNode>,
      currentId: string,
      forks: Array<Fork>
    } = { snapshots: {}, currentId: "root", forks: [] }
  }
  
  // ═══════════════════════════════════════════════════════════
  // TYPES
  // ═══════════════════════════════════════════════════════════
  
  type NpcState = {
    id: string,
    name: string,
    role: "farmer" | "merchant" | "blacksmith" | "beggar" | "prophet" | "mayor",
    position: { x: number, y: number },
    schedule: Array<ScheduleEntry>,
    needs: { hunger: number, fatigue: number, mood: number },
    mind: {
      status: "frozen" | "active",
      thought: string | null,
      lastHydrateAt: number | null
    },
    memoryBuffer: Array<EventPointer>,
    memories: Array<Memory>,
    relationships: Record<string, number>
  }
  
  type ScheduleEntry = {
    hour: number,
    location: { x: number, y: number },
    activity: string
  }
  
  type EventPointer = {
    eventType: string,
    tick: number,
    data: Record<string, unknown>
  }
  
  type Memory = {
    tick: number,
    summary: string,
    emotion: "joy" | "fear" | "anger" | "sadness" | "surprise" | "neutral"
  }
  
  type Prayer = {
    id: string,
    npcId: string,
    content: string,
    priority: number,
    createdAt: number,
    category: "blessing" | "punishment" | "weather" | "healing" | "other"
  }
  
  type ConsoleLine = {
    id: string,
    type: "input" | "system" | "intent" | "patch" | "effect" | "error",
    content: string,
    timestamp: number,
    llmCost: number | null
  }
  
  type UIEffect = {
    id: string,
    type: string,
    params: Record<string, unknown>,
    duration: number,
    createdAt: number
  }
  
  type TimelineNode = {
    id: string,
    parentId: string | null,
    tick: number,
    snapshotHash: string,
    events: Array<string>,
    badges: Array<"miracle" | "weather" | "dialogue" | "death" | "birth">
  }
  
  type Fork = {
    id: string,
    fromNodeId: string,
    reason: string,
    createdAt: number
  }
  
  // ═══════════════════════════════════════════════════════════
  // COMPUTED
  // ═══════════════════════════════════════════════════════════
  
  // Zone calculation (Manhattan distance ≤ 5)
  computed zone1NpcIds = filter(
    keys(npcs),
    lte(
      add(
        abs(sub(npcs[$item].position.x, player.x)),
        abs(sub(npcs[$item].position.y, player.y))
      ),
      5
    )
  )
  
  computed zone2NpcIds = filter(
    keys(npcs),
    gt(
      add(
        abs(sub(npcs[$item].position.x, player.x)),
        abs(sub(npcs[$item].position.y, player.y))
      ),
      5
    )
  )
  
  computed zone1NpcCount = len(zone1NpcIds)
  computed zone2NpcCount = len(zone2NpcIds)
  
  // Divine reputation derived
  computed reputationTitle = cond(
    gt(reputation.fear, add(reputation.mercy, 10)),
    "폭군",
    cond(
      gt(reputation.mercy, add(reputation.fear, 10)),
      "자비로운 신",
      "중립적 신"
    )
  )
  
  // Prayer queue by priority
  computed topPrayer = cond(
    gt(len(prayerQueue), 0),
    at(prayerQueue, 0),
    null
  )
  
  computed pendingPrayerCount = len(prayerQueue)
  
  // Selected NPC (for Inspector)
  computed selectedNpc = cond(
    isNotNull(selectedNpcId),
    at(npcs, selectedNpcId),
    null
  )
  
  // Time display
  computed timeDisplay = concat(
    "Day ", toString(time.day), " - ", 
    cond(lt(time.hour, 10), "0", ""),
    toString(time.hour), ":00"
  )
  
  // Weather icon
  computed weatherIcon = cond(
    eq(time.weather, "clear"), "☀️",
    cond(
      eq(time.weather, "rain"), "🌧️",
      cond(
        eq(time.weather, "storm"), "⛈️",
        "🌫️"
      )
    )
  )
  
  // ═══════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════
  
  // --- Console Actions ---
  
  action console.submit(rawInput: string) {
    // Add input to history
    patch console.history = append(console.history, {
      id: $system.uuid,
      type: "input",
      content: concat("GOD_MODE > ", rawInput),
      timestamp: $system.time.now,
      llmCost: null
    })
    
    // Set pending (triggers LLM parsing)
    patch console.pending = rawInput
    
    // Request intent parsing
    effect llm.parseIntent({
      input: rawInput,
      context: {
        weather: time.weather,
        hour: time.hour,
        nearbyNpcs: zone1NpcIds,
        reputation: reputation
      },
      into: parsedIntent
    })
  }
  
  action console.applyIntent(intent: ParsedIntent) {
    // Log intent
    patch console.history = append(console.history, {
      id: $system.uuid,
      type: "intent",
      content: concat("[Intent] ", intent.type, " ", toString(intent.params)),
      timestamp: $system.time.now,
      llmCost: intent.cost
    })
    
    // Clear pending
    patch console.pending = null
    
    // Dispatch to appropriate action based on intent type
    when eq(intent.type, "SMITE") {
      call divine.smite(intent.params.targetId, intent.params.power)
    }
    
    when eq(intent.type, "BLESS") {
      call divine.bless(intent.params.targetId, intent.params.blessing)
    }
    
    when eq(intent.type, "CHANGE_WEATHER") {
      call divine.changeWeather(intent.params.weather)
    }
    
    when eq(intent.type, "SPEAK") {
      call divine.speak(intent.params.targetId, intent.params.message)
    }
    
    when eq(intent.type, "GRANT_PRAYER") {
      call divine.grantPrayer(intent.params.prayerId)
    }
    
    when eq(intent.type, "DENY_PRAYER") {
      call divine.denyPrayer(intent.params.prayerId)
    }
  }
  
  // --- Divine Actions ---
  
  action divine.smite(targetId: string, power: number) {
    // Get target position
    when isNotNull(at(npcs, targetId)) {
      // Update NPC state
      patch npcs[targetId].needs.mood = sub(npcs[targetId].needs.mood, power)
      
      // Add to memory buffer
      patch npcs[targetId].memoryBuffer = append(
        npcs[targetId].memoryBuffer,
        { eventType: "smited", tick: time.tick, data: { power: power } }
      )
      
      // Activate mind if in Zone1
      when includes(zone1NpcIds, targetId) {
        patch npcs[targetId].mind.status = "active"
      }
      
      // Update reputation
      patch reputation.fear = add(reputation.fear, div(power, 10))
      
      // Queue UI effects
      effect ui.queueEffect({
        type: "lightning",
        params: { 
          x: npcs[targetId].position.x, 
          y: npcs[targetId].position.y,
          intensity: power
        },
        duration: 500
      })
      
      effect ui.queueEffect({
        type: "flash",
        params: { color: "#FFFF00", opacity: 0.8 },
        duration: 200
      })
      
      effect ui.queueEffect({
        type: "shake",
        params: { intensity: div(power, 20), axis: "both" },
        duration: 300
      })
      
      effect ui.queueEffect({
        type: "bubble",
        params: { 
          npcId: targetId, 
          text: "으악!",
          emotion: "fear"
        },
        duration: 2000
      })
      
      // Thunder sound
      effect ui.queueEffect({
        type: "sound",
        params: { name: "thunder", volume: div(power, 100) },
        duration: 1000
      })
      
      // Trigger nearby NPC reactions (Zone1 only)
      effect npc.triggerReactions({
        eventType: "witnessed_smite",
        sourceNpcId: targetId,
        affectedNpcIds: zone1NpcIds,
        data: { power: power }
      })
      
      // Prophet interpretation (if prophet exists in Zone1)
      effect prophet.interpret({
        eventType: "smite",
        targetName: npcs[targetId].name,
        reputation: reputation
      })
      
      // Log
      patch console.history = append(console.history, {
        id: $system.uuid,
        type: "effect",
        content: concat("⚡ ", npcs[targetId].name, "에게 천벌 (위력: ", toString(power), ")"),
        timestamp: $system.time.now,
        llmCost: null
      })
    }
  }
  
  action divine.bless(targetId: string, blessing: string) {
    when isNotNull(at(npcs, targetId)) {
      // Increase mood
      patch npcs[targetId].needs.mood = min(add(npcs[targetId].needs.mood, 30), 100)
      
      // Add to memory buffer
      patch npcs[targetId].memoryBuffer = append(
        npcs[targetId].memoryBuffer,
        { eventType: "blessed", tick: time.tick, data: { blessing: blessing } }
      )
      
      // Activate mind
      when includes(zone1NpcIds, targetId) {
        patch npcs[targetId].mind.status = "active"
      }
      
      // Update reputation
      patch reputation.mercy = add(reputation.mercy, 5)
      
      // Queue UI effects
      effect ui.queueEffect({
        type: "blessing",
        params: {
          x: npcs[targetId].position.x,
          y: npcs[targetId].position.y,
          particles: "golden"
        },
        duration: 2000
      })
      
      effect ui.queueEffect({
        type: "spotlight",
        params: {
          x: npcs[targetId].position.x,
          y: npcs[targetId].position.y,
          color: "#FFD700",
          radius: 3
        },
        duration: 1500
      })
      
      effect ui.queueEffect({
        type: "bubble",
        params: {
          npcId: targetId,
          text: "감사합니다, 신이시여!",
          emotion: "joy"
        },
        duration: 2500
      })
      
      effect ui.queueEffect({
        type: "sound",
        params: { name: "choir", volume: 0.5 },
        duration: 2000
      })
      
      // Prophet interpretation
      effect prophet.interpret({
        eventType: "bless",
        targetName: npcs[targetId].name,
        reputation: reputation
      })
      
      // Log
      patch console.history = append(console.history, {
        id: $system.uuid,
        type: "effect",
        content: concat("✨ ", npcs[targetId].name, "에게 축복: ", blessing),
        timestamp: $system.time.now,
        llmCost: null
      })
    }
  }
  
  action divine.changeWeather(newWeather: "clear" | "rain" | "storm" | "fog") {
    patch time.weather = newWeather
    
    // Global weather effect
    effect ui.queueEffect({
      type: "weatherTransition",
      params: { from: time.weather, to: newWeather },
      duration: 3000
    })
    
    // Weather-specific effects
    when eq(newWeather, "storm") {
      effect ui.queueEffect({
        type: "flash",
        params: { color: "#FFFFFF", opacity: 0.6 },
        duration: 150
      })
      
      effect ui.queueEffect({
        type: "shake",
        params: { intensity: 2, axis: "horizontal" },
        duration: 200
      })
      
      effect ui.queueEffect({
        type: "sound",
        params: { name: "thunder_distant", volume: 0.7 },
        duration: 3000
      })
      
      // All Zone1 NPCs react to storm
      effect npc.triggerReactions({
        eventType: "weather_change",
        sourceNpcId: null,
        affectedNpcIds: zone1NpcIds,
        data: { weather: "storm" }
      })
    }
    
    // Reputation change based on weather
    when eq(newWeather, "rain") {
      // Check if anyone prayed for rain
      when gt(len(filter(prayerQueue, eq($item.category, "weather"))), 0) {
        patch reputation.mercy = add(reputation.mercy, 3)
      }
    }
    
    // Log
    patch console.history = append(console.history, {
      id: $system.uuid,
      type: "effect",
      content: concat("🌤️ 날씨 변경: ", newWeather),
      timestamp: $system.time.now,
      llmCost: null
    })
  }
  
  action divine.speak(targetId: string, message: string) {
    when isNotNull(at(npcs, targetId)) {
      // Divine voice effect
      effect ui.queueEffect({
        type: "divineVoice",
        params: {
          npcId: targetId,
          message: message
        },
        duration: 4000
      })
      
      effect ui.queueEffect({
        type: "vignette",
        params: { color: "#000000", intensity: 0.3 },
        duration: 4000
      })
      
      effect ui.queueEffect({
        type: "sound",
        params: { name: "divine_whisper", volume: 0.8 },
        duration: 2000
      })
      
      // Add to NPC memory
      patch npcs[targetId].memoryBuffer = append(
        npcs[targetId].memoryBuffer,
        { eventType: "divine_message", tick: time.tick, data: { message: message } }
      )
      
      // Force hydrate to process the message
      effect npc.hydrate({
        npcId: targetId,
        reason: "divine_message",
        forceActive: true
      })
      
      // Log
      patch console.history = append(console.history, {
        id: $system.uuid,
        type: "effect",
        content: concat("📢 ", npcs[targetId].name, "에게 신탁: \"", message, "\""),
        timestamp: $system.time.now,
        llmCost: null
      })
    }
  }
  
  action divine.grantPrayer(prayerId: string) {
    // Find and process prayer
    when gt(len(filter(prayerQueue, eq($item.id, prayerId))), 0) {
      // Get prayer
      effect prayer.grant({
        prayerId: prayerId,
        into: grantResult
      })
      
      // Remove from queue
      patch prayerQueue = filter(prayerQueue, neq($item.id, prayerId))
      
      // Reputation
      patch reputation.mercy = add(reputation.mercy, 5)
      
      // Effects
      effect ui.queueEffect({
        type: "prayerGranted",
        params: { prayerId: prayerId },
        duration: 2000
      })
      
      effect ui.queueEffect({
        type: "sound",
        params: { name: "prayer_granted", volume: 0.6 },
        duration: 1500
      })
    }
  }
  
  action divine.denyPrayer(prayerId: string) {
    when gt(len(filter(prayerQueue, eq($item.id, prayerId))), 0) {
      // Remove from queue
      patch prayerQueue = filter(prayerQueue, neq($item.id, prayerId))
      
      // Slight fear increase
      patch reputation.fear = add(reputation.fear, 2)
      
      // Effects
      effect ui.queueEffect({
        type: "prayerDenied",
        params: { prayerId: prayerId },
        duration: 1500
      })
      
      effect ui.queueEffect({
        type: "sound",
        params: { name: "prayer_denied", volume: 0.4 },
        duration: 1000
      })
    }
  }
  
  // --- Tick Actions ---
  
  action tick.advance() {
    // Increment tick
    patch time.tick = add(time.tick, 1)
    
    // Hour progression (1 hour = 10 ticks)
    when eq(mod(time.tick, 10), 0) {
      patch time.hour = mod(add(time.hour, 1), 24)
      
      // Day progression
      when eq(time.hour, 0) {
        patch time.day = add(time.day, 1)
      }
    }
    
    // Process all NPCs
    effect npc.processAllTick({
      zone1Ids: zone1NpcIds,
      zone2Ids: zone2NpcIds,
      currentHour: time.hour,
      weather: time.weather
    })
    
    // Check for zone transitions
    effect npc.checkZoneTransitions({
      zone1Ids: zone1NpcIds,
      previousZone1Ids: $meta.previousZone1Ids
    })
    
    // Generate prayers occasionally
    when eq(mod(time.tick, 50), 0) {
      effect prayer.generate({
        eligibleNpcIds: keys(npcs),
        reputation: reputation,
        into: newPrayer
      })
    }
    
    // Timeline snapshot
    effect timeline.createSnapshot({
      tick: time.tick,
      significantEvents: effectQueue
    })
  }
  
  // --- NPC Actions ---
  
  action npc.select(npcId: string) {
    patch selectedNpcId = npcId
    
    // If in Zone2, trigger hydrate
    when includes(zone2NpcIds, npcId) {
      effect npc.hydrate({
        npcId: npcId,
        reason: "player_inspection",
        forceActive: true
      })
    }
  }
  
  action npc.deselect() {
    patch selectedNpcId = null
  }
  
  action npc.updateFromHydrate(npcId: string, hydrateResult: HydrateResult) {
    when isNotNull(at(npcs, npcId)) {
      // Update thought
      patch npcs[npcId].mind.thought = hydrateResult.thought
      patch npcs[npcId].mind.status = "active"
      patch npcs[npcId].mind.lastHydrateAt = time.tick
      
      // Convert buffer events to memories
      patch npcs[npcId].memories = concat(
        npcs[npcId].memories,
        hydrateResult.newMemories
      )
      
      // Clear buffer
      patch npcs[npcId].memoryBuffer = []
      
      // Maybe show bubble
      when hydrateResult.showBubble {
        effect ui.queueEffect({
          type: "bubble",
          params: {
            npcId: npcId,
            text: hydrateResult.bubbleText,
            emotion: hydrateResult.emotion
          },
          duration: 2000
        })
      }
    }
  }
  
  // --- Player Actions ---
  
  action player.move(dx: number, dy: number) {
    patch player.x = clamp(add(player.x, dx), 0, sub(grid.width, 1))
    patch player.y = clamp(add(player.y, dy), 0, sub(grid.height, 1))
  }
  
  action player.teleport(x: number, y: number) {
    patch player.x = clamp(x, 0, sub(grid.width, 1))
    patch player.y = clamp(y, 0, sub(grid.height, 1))
    
    // Check for NPCs that just entered Zone1
    effect npc.checkZoneTransitions({
      zone1Ids: zone1NpcIds,
      previousZone1Ids: $meta.previousZone1Ids
    })
  }
  
  // --- Timeline Actions ---
  
  action timeline.jumpTo(nodeId: string) {
    when isNotNull(at(timeline.snapshots, nodeId)) {
      // Load snapshot
      effect timeline.loadSnapshot({
        nodeId: nodeId,
        into: loadedSnapshot
      })
      
      // Visual effect
      effect ui.queueEffect({
        type: "rewind",
        params: { 
          fromTick: time.tick,
          toTick: timeline.snapshots[nodeId].tick
        },
        duration: 1500
      })
      
      effect ui.queueEffect({
        type: "glitch",
        params: { intensity: 0.5 },
        duration: 500
      })
      
      effect ui.queueEffect({
        type: "sound",
        params: { name: "time_warp", volume: 0.7 },
        duration: 1500
      })
      
      patch timeline.currentId = nodeId
    }
  }
  
  action timeline.fork(reason: string) {
    effect timeline.createFork({
      fromNodeId: timeline.currentId,
      reason: reason,
      into: newForkId
    })
    
    effect ui.queueEffect({
      type: "forkVisual",
      params: { fromNodeId: timeline.currentId },
      duration: 1000
    })
    
    effect ui.queueEffect({
      type: "sound",
      params: { name: "timeline_fork", volume: 0.5 },
      duration: 800
    })
  }
  
  // --- Effect Queue Management ---
  
  action ui.consumeEffect(effectId: string) {
    patch effectQueue = filter(effectQueue, neq($item.id, effectId))
  }
  
  action ui.clearEffects() {
    patch effectQueue = []
  }
}
```

---

## 3. State Specification

### 3.1 Core State Shape

```typescript
interface GodsDesktopState {
  // World Grid
  grid: {
    width: number;   // Default: 20
    height: number;  // Default: 15
  };
  
  // Time System
  time: {
    tick: number;    // Monotonic counter
    hour: number;    // 0-23
    day: number;     // Starting from 1
    weather: 'clear' | 'rain' | 'storm' | 'fog';
  };
  
  // Player (God's Focus Point)
  player: {
    x: number;
    y: number;
  };
  
  // NPCs
  npcs: Record<string, NpcState>;
  
  // Divine Systems
  reputation: {
    fear: number;    // 0-100
    mercy: number;   // 0-100
  };
  prayerQueue: Prayer[];
  
  // UI State
  console: {
    history: ConsoleLine[];
    pending: string | null;
  };
  selectedNpcId: string | null;
  effectQueue: UIEffect[];
  
  // Timeline
  timeline: {
    snapshots: Record<string, TimelineNode>;
    currentId: string;
    forks: Fork[];
  };
}
```

### 3.2 NPC State Detail

```typescript
interface NpcState {
  id: string;
  name: string;
  role: NpcRole;
  
  // Physical
  position: { x: number; y: number };
  schedule: ScheduleEntry[];
  
  // Needs (0-100)
  needs: {
    hunger: number;
    fatigue: number;
    mood: number;
  };
  
  // Mind (AI LOD)
  mind: {
    status: 'frozen' | 'active';
    thought: string | null;
    lastHydrateAt: number | null;
  };
  
  // Memory System
  memoryBuffer: EventPointer[];  // Cheap pointers (Zone2)
  memories: Memory[];            // Processed memories (Zone1)
  
  // Relationships
  relationships: Record<string, number>;  // NPC ID -> affinity (-100 to 100)
}

type NpcRole = 
  | 'farmer' 
  | 'merchant' 
  | 'blacksmith' 
  | 'beggar' 
  | 'prophet' 
  | 'mayor';
```

---

## 4. Computed Specification

### 4.1 Zone Calculations

| Computed | Formula | Purpose |
|----------|---------|---------|
| `zone1NpcIds` | Manhattan distance ≤ 5 | High AI NPCs |
| `zone2NpcIds` | Manhattan distance > 5 | Low AI NPCs |
| `zone1NpcCount` | `len(zone1NpcIds)` | UI display |
| `zone2NpcCount` | `len(zone2NpcIds)` | UI display |

### 4.2 Divine Computed

| Computed | Formula | Purpose |
|----------|---------|---------|
| `reputationTitle` | fear vs mercy threshold | UI badge |
| `topPrayer` | First in queue | Quick access |
| `pendingPrayerCount` | Queue length | UI badge |

### 4.3 UI Helper Computed

| Computed | Formula | Purpose |
|----------|---------|---------|
| `selectedNpc` | Lookup by ID | Inspector binding |
| `timeDisplay` | Format string | UI display |
| `weatherIcon` | Emoji mapping | UI display |

---

## 5. Actions Specification

### 5.1 Action Categories

| Category | Actions | LLM Involved |
|----------|---------|--------------|
| **Console** | `console.submit`, `console.applyIntent` | Yes (parsing) |
| **Divine** | `divine.smite`, `divine.bless`, `divine.changeWeather`, `divine.speak`, `divine.grantPrayer`, `divine.denyPrayer` | No |
| **Tick** | `tick.advance` | Conditional |
| **NPC** | `npc.select`, `npc.deselect`, `npc.updateFromHydrate` | Conditional |
| **Player** | `player.move`, `player.teleport` | No |
| **Timeline** | `timeline.jumpTo`, `timeline.fork` | No |
| **UI** | `ui.consumeEffect`, `ui.clearEffects` | No |

### 5.2 Intent Types (LLM Output)

```typescript
type ParsedIntent = 
  | { type: 'SMITE'; params: { targetId: string; power: number } }
  | { type: 'BLESS'; params: { targetId: string; blessing: string } }
  | { type: 'CHANGE_WEATHER'; params: { weather: WeatherType } }
  | { type: 'SPEAK'; params: { targetId: string; message: string } }
  | { type: 'GRANT_PRAYER'; params: { prayerId: string } }
  | { type: 'DENY_PRAYER'; params: { prayerId: string } }
  | { type: 'UNKNOWN'; params: { rawInput: string } };
```

---

## 6. Effect System

### 6.1 Effect Categories

```
┌─────────────────────────────────────────────────────────────────┐
│                        EFFECT SYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   VISUAL    │  │    AUDIO    │  │       DRAMATIC          │ │
│  ├─────────────┤  ├─────────────┤  ├─────────────────────────┤ │
│  │ flash       │  │ sound       │  │ slowMotion              │ │
│  │ shake       │  │ music       │  │ fastForward             │ │
│  │ lightning   │  │ ambient     │  │ splitScreen             │ │
│  │ blessing    │  │ silence     │  │ spotlight               │ │
│  │ vignette    │  │             │  │ blackout                │ │
│  │ glitch      │  │             │  │ zoomTo                  │ │
│  │ colorShift  │  │             │  │ panTo                   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   WEATHER   │  │    TEXT     │  │       PARTICLE          │ │
│  ├─────────────┤  ├─────────────┤  ├─────────────────────────┤ │
│  │ rain        │  │ bubble      │  │ sparkles                │ │
│  │ snow        │  │ narration   │  │ ashFall                 │ │
│  │ fog         │  │ prophecy    │  │ fireflies               │ │
│  │ eclipse     │  │ whisper     │  │ bloodRain               │ │
│  │ sunbeam     │  │ echo        │  │ goldenDust              │ │
│  │ aurora      │  │ divineVoice │  │ curseMist               │ │
│  └─────────────┘  │ consoleLine │  └─────────────────────────┘ │
│                   └─────────────┘                               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      TIME/TIMELINE                       │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ rewind │ forkVisual │ timeSkip │ montage │ freeze       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Visual Effects

#### 6.2.1 Flash

화면 전체가 특정 색으로 번쩍임.

```typescript
type FlashEffect = {
  type: 'flash';
  params: {
    color: string;      // Hex color, default: '#FFFFFF'
    opacity: number;    // 0-1, default: 0.8
    easing: 'linear' | 'easeOut' | 'easeIn';  // default: 'easeOut'
  };
  duration: number;     // ms, default: 200
};
```

**사용 예:**
- 벼락: `{ color: '#FFFF00', opacity: 0.9 }`
- 축복: `{ color: '#FFD700', opacity: 0.5 }`
- 폭발: `{ color: '#FF4500', opacity: 1.0 }`

#### 6.2.2 Shake

화면 흔들림.

```typescript
type ShakeEffect = {
  type: 'shake';
  params: {
    intensity: number;  // 1-10, pixel displacement
    axis: 'horizontal' | 'vertical' | 'both';
    frequency: number;  // Hz, default: 30
  };
  duration: number;
};
```

#### 6.2.3 Lightning

특정 좌표에 벼락 스프라이트.

```typescript
type LightningEffect = {
  type: 'lightning';
  params: {
    x: number;
    y: number;
    intensity: number;    // 1-100
    branches: number;     // 1-5, lightning forks
    color: string;        // default: '#00BFFF'
  };
  duration: number;
};
```

#### 6.2.4 Blessing

축복 파티클 효과.

```typescript
type BlessingEffect = {
  type: 'blessing';
  params: {
    x: number;
    y: number;
    particles: 'golden' | 'white' | 'rainbow';
    radius: number;
    ascend: boolean;  // Particles rise upward
  };
  duration: number;
};
```

#### 6.2.5 Vignette

화면 가장자리 어두워짐.

```typescript
type VignetteEffect = {
  type: 'vignette';
  params: {
    color: string;      // default: '#000000'
    intensity: number;  // 0-1
    innerRadius: number; // 0-1, where effect starts
  };
  duration: number;
};
```

#### 6.2.6 Glitch

디지털 글리치 효과 (신의 분노, 타임라인 불안정).

```typescript
type GlitchEffect = {
  type: 'glitch';
  params: {
    intensity: number;    // 0-1
    slices: number;       // Screen slice count
    colorShift: boolean;  // RGB shift
    scanlines: boolean;
  };
  duration: number;
};
```

#### 6.2.7 ColorShift

화면 전체 색조 변화.

```typescript
type ColorShiftEffect = {
  type: 'colorShift';
  params: {
    hueRotate: number;    // degrees
    saturate: number;     // 0-2
    brightness: number;   // 0-2
    sepia: number;        // 0-1
  };
  duration: number;
};
```

### 6.3 Audio Effects

#### 6.3.1 Sound

단발성 사운드.

```typescript
type SoundEffect = {
  type: 'sound';
  params: {
    name: SoundName;
    volume: number;       // 0-1
    pitch: number;        // 0.5-2, default: 1
    pan: number;          // -1 to 1, stereo position
  };
  duration: number;
};

type SoundName = 
  // Divine
  | 'thunder' | 'thunder_distant' | 'choir' | 'divine_whisper'
  | 'prayer_granted' | 'prayer_denied' | 'blessing_chime'
  // Weather
  | 'rain_start' | 'rain_heavy' | 'wind' | 'storm_ambient'
  // Timeline
  | 'time_warp' | 'timeline_fork' | 'rewind_whoosh'
  // UI
  | 'console_beep' | 'intent_parsed' | 'effect_applied'
  // NPC
  | 'gasp' | 'scream' | 'cheer' | 'whisper' | 'footsteps';
```

#### 6.3.2 Music

배경 음악 변경.

```typescript
type MusicEffect = {
  type: 'music';
  params: {
    track: MusicTrack;
    fadeIn: number;       // ms
    fadeOut: number;      // ms
    loop: boolean;
  };
  duration: number;       // 0 for indefinite
};

type MusicTrack = 
  | 'peaceful' | 'tension' | 'divine' | 'chaos' 
  | 'melancholy' | 'triumph' | 'silence';
```

#### 6.3.3 Ambient

환경음 레이어.

```typescript
type AmbientEffect = {
  type: 'ambient';
  params: {
    layer: AmbientLayer;
    volume: number;
    fade: number;
  };
  duration: number;
};

type AmbientLayer = 
  | 'village' | 'rain' | 'storm' | 'wind' | 'fire' 
  | 'crowd' | 'night_crickets' | 'church_bells';
```

### 6.4 Dramatic Effects

#### 6.4.1 SlowMotion

시간 흐름 느리게.

```typescript
type SlowMotionEffect = {
  type: 'slowMotion';
  params: {
    factor: number;       // 0.1-1, speed multiplier
    affectAudio: boolean; // Pitch shift audio
    vignette: boolean;    // Add cinematic vignette
  };
  duration: number;
};
```

**"이런 것도 된다고?" 포인트:**
- 벼락이 떨어지는 순간 0.2배속으로 전환
- NPC 표정 변화가 극적으로 보임

#### 6.4.2 FastForward

시간 빨리감기 (날씨 변화 등).

```typescript
type FastForwardEffect = {
  type: 'fastForward';
  params: {
    factor: number;       // 2-10, speed multiplier
    showTrails: boolean;  // Motion blur trails
    skipTicks: number;    // Actual ticks to skip
  };
  duration: number;
};
```

#### 6.4.3 SplitScreen

화면 분할로 여러 반응 동시에 보여주기.

```typescript
type SplitScreenEffect = {
  type: 'splitScreen';
  params: {
    layout: '2-horizontal' | '2-vertical' | '4-grid' | '3-focus';
    focuses: Array<{
      type: 'npc' | 'location';
      target: string;     // NPC ID or "x,y"
      label?: string;
    }>;
    borderStyle: 'sharp' | 'fade' | 'torn';
  };
  duration: number;
};
```

**"이런 것도 된다고?" 포인트:**
- 벼락 맞은 상인 + 목격자 반응 + 예언자 해석을 동시에 3분할로 보여줌

#### 6.4.4 Spotlight

특정 대상에 스포트라이트.

```typescript
type SpotlightEffect = {
  type: 'spotlight';
  params: {
    x: number;
    y: number;
    radius: number;       // Grid cells
    color: string;
    dimOthers: number;    // 0-1, how much to dim rest
    followTarget?: string; // NPC ID to follow
  };
  duration: number;
};
```

#### 6.4.5 Blackout

점진적 암전.

```typescript
type BlackoutEffect = {
  type: 'blackout';
  params: {
    fadeSpeed: number;    // ms to full black
    holdDuration: number; // ms at full black
    text?: string;        // Text to show during blackout
  };
  duration: number;
};
```

#### 6.4.6 ZoomTo

특정 위치로 카메라 줌.

```typescript
type ZoomToEffect = {
  type: 'zoomTo';
  params: {
    x: number;
    y: number;
    scale: number;        // 1-5, zoom level
    easing: 'linear' | 'easeInOut' | 'bounce';
  };
  duration: number;
};
```

#### 6.4.7 PanTo

카메라 이동.

```typescript
type PanToEffect = {
  type: 'panTo';
  params: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    easing: string;
  };
  duration: number;
};
```

### 6.5 Weather Effects

#### 6.5.1 Rain

비 효과 (전역 오버레이).

```typescript
type RainEffect = {
  type: 'rain';
  params: {
    intensity: 'light' | 'medium' | 'heavy' | 'torrential';
    wind: number;         // -1 to 1, direction
    splash: boolean;      // Ground splash particles
    thunder: boolean;     // Occasional thunder
  };
  duration: number;       // 0 for indefinite
};
```

#### 6.5.2 Snow

눈 효과.

```typescript
type SnowEffect = {
  type: 'snow';
  params: {
    intensity: 'flurry' | 'steady' | 'blizzard';
    accumulate: boolean;  // Show on ground
    wind: number;
  };
  duration: number;
};
```

#### 6.5.3 Fog

안개 효과.

```typescript
type FogEffect = {
  type: 'fog';
  params: {
    density: number;      // 0-1
    color: string;
    animate: boolean;     // Swirling motion
    reduceVisibility: number; // Grid cells visible
  };
  duration: number;
};
```

#### 6.5.4 Eclipse

일식/월식 (강력한 신적 행위).

```typescript
type EclipseEffect = {
  type: 'eclipse';
  params: {
    type: 'solar' | 'lunar';
    phase: 'partial' | 'total';
    corona: boolean;      // Show corona effect
  };
  duration: number;
};
```

**"이런 것도 된다고?" 포인트:**
- 신이 극도로 분노하면 일식 발동
- 모든 NPC가 공포에 질림

#### 6.5.5 Sunbeam

신성한 햇살.

```typescript
type SunbeamEffect = {
  type: 'sunbeam';
  params: {
    x: number;
    y: number;
    width: number;
    angle: number;        // degrees
    particlesInBeam: boolean;
  };
  duration: number;
};
```

#### 6.5.6 Aurora

오로라 (축복/기적의 전조).

```typescript
type AuroraEffect = {
  type: 'aurora';
  params: {
    colors: string[];     // Gradient colors
    intensity: number;
    movement: 'slow' | 'medium' | 'dancing';
  };
  duration: number;
};
```

### 6.6 Text Effects

#### 6.6.1 Bubble

NPC 말풍선.

```typescript
type BubbleEffect = {
  type: 'bubble';
  params: {
    npcId: string;
    text: string;
    emotion: EmotionType;
    style: 'speech' | 'thought' | 'shout' | 'whisper';
    typewriter: boolean;  // Type out effect
  };
  duration: number;
};

type EmotionType = 
  | 'joy' | 'fear' | 'anger' | 'sadness' 
  | 'surprise' | 'disgust' | 'neutral';
```

#### 6.6.2 Narration

극적인 내레이션 (화면 중앙/하단).

```typescript
type NarrationEffect = {
  type: 'narration';
  params: {
    text: string;
    position: 'top' | 'center' | 'bottom';
    style: 'epic' | 'whisper' | 'ancient' | 'modern';
    typewriter: boolean;
    voiceover?: SoundName;
  };
  duration: number;
};
```

**"이런 것도 된다고?" 포인트:**
- `"그리하여 신의 분노가 마을에 내렸으니..."` 같은 텍스트가 영화처럼 표시됨

#### 6.6.3 Prophecy

예언자 전용 스타일.

```typescript
type ProphecyEffect = {
  type: 'prophecy';
  params: {
    text: string;
    prophetId: string;
    style: 'ominous' | 'hopeful' | 'cryptic';
    glowColor: string;
    echoRepeat: number;   // 0-3, echo repetitions
  };
  duration: number;
};
```

#### 6.6.4 Whisper

비밀스러운 텍스트 (화면 가장자리에서 희미하게).

```typescript
type WhisperEffect = {
  type: 'whisper';
  params: {
    text: string;
    position: 'left' | 'right' | 'top' | 'bottom';
    opacity: number;
    drift: boolean;       // Slowly move
  };
  duration: number;
};
```

#### 6.6.5 Echo

텍스트 반복 (신의 목소리).

```typescript
type EchoEffect = {
  type: 'echo';
  params: {
    text: string;
    repetitions: number;  // 2-5
    fadePerRepeat: number;
    delayBetween: number; // ms
    scaleDown: boolean;
  };
  duration: number;
};
```

#### 6.6.6 DivineVoice

신이 NPC에게 직접 말할 때.

```typescript
type DivineVoiceEffect = {
  type: 'divineVoice';
  params: {
    npcId: string;
    message: string;
    visualStyle: 'burning_letters' | 'golden_glow' | 'shadow_text';
    shakeOnReveal: boolean;
    soundEffect: SoundName;
  };
  duration: number;
};
```

**"이런 것도 된다고?" 포인트:**
- 글자가 불타는 듯 나타나며 NPC에게 직접 메시지 전달

#### 6.6.7 ConsoleLine

콘솔 출력 (시스템 로그 느낌).

```typescript
type ConsoleLineEffect = {
  type: 'consoleLine';
  params: {
    text: string;
    type: 'system' | 'intent' | 'patch' | 'effect' | 'error';
    highlight: boolean;
    llmIndicator: boolean; // Show 💸 if LLM used
  };
  duration: number;
};
```

### 6.7 Particle Effects

#### 6.7.1 Sparkles

반짝임 파티클.

```typescript
type SparklesEffect = {
  type: 'sparkles';
  params: {
    x: number;
    y: number;
    radius: number;
    color: string;
    count: number;
    float: boolean;
  };
  duration: number;
};
```

#### 6.7.2 AshFall

재/먼지 낙하 (재앙 후).

```typescript
type AshFallEffect = {
  type: 'ashFall';
  params: {
    intensity: number;
    color: 'gray' | 'red' | 'black';
    windDirection: number;
  };
  duration: number;
};
```

#### 6.7.3 Fireflies

반딧불이 (평화로운 밤).

```typescript
type FirefliesEffect = {
  type: 'fireflies';
  params: {
    count: number;
    brightness: number;
    area: { x: number; y: number; width: number; height: number };
  };
  duration: number;
};
```

#### 6.7.4 BloodRain

피의 비 (극단적 폭군 플레이).

```typescript
type BloodRainEffect = {
  type: 'bloodRain';
  params: {
    intensity: number;
    thunderColor: string;  // Red lightning
    fearIncrease: number;  // Reputation impact
  };
  duration: number;
};
```

**"이런 것도 된다고?" 포인트:**
- 공포 평판이 극도로 높아지면 하늘에서 피가 내림
- 모든 NPC가 기도하기 시작

#### 6.7.5 GoldenDust

황금빛 먼지 (자비로운 신).

```typescript
type GoldenDustEffect = {
  type: 'goldenDust';
  params: {
    intensity: number;
    glitter: boolean;
    healingAura: boolean;
  };
  duration: number;
};
```

#### 6.7.6 CurseMist

저주의 안개 (특정 NPC 주변).

```typescript
type CurseMistEffect = {
  type: 'curseMist';
  params: {
    targetNpcId: string;
    color: 'purple' | 'green' | 'black';
    radius: number;
    whispers: boolean;    // Faint whisper sounds
  };
  duration: number;
};
```

### 6.8 Timeline Effects

#### 6.8.1 Rewind

되감기 시각 효과.

```typescript
type RewindEffect = {
  type: 'rewind';
  params: {
    fromTick: number;
    toTick: number;
    showFrames: boolean;  // Show key frames passing
    vhsStyle: boolean;    // VHS rewind aesthetic
  };
  duration: number;
};
```

**"이런 것도 된다고?" 포인트:**
- 시간이 거꾸로 가는 동안 이전 장면들이 빠르게 스쳐지나감

#### 6.8.2 ForkVisual

타임라인 분기 시각화.

```typescript
type ForkVisualEffect = {
  type: 'forkVisual';
  params: {
    fromNodeId: string;
    branchCount: number;
    showAlternatives: boolean; // Brief glimpse of other paths
  };
  duration: number;
};
```

#### 6.8.3 TimeSkip

시간 빠르게 흐르는 효과.

```typescript
type TimeSkipEffect = {
  type: 'timeSkip';
  params: {
    fromTime: { day: number; hour: number };
    toTime: { day: number; hour: number };
    showSunMoonCycle: boolean;
    showActivityMontage: boolean;
  };
  duration: number;
};
```

#### 6.8.4 Montage

여러 장면 빠르게 보여주기.

```typescript
type MontageEffect = {
  type: 'montage';
  params: {
    scenes: Array<{
      focusType: 'npc' | 'location';
      target: string;
      caption?: string;
    }>;
    transitionStyle: 'cut' | 'fade' | 'wipe';
  };
  duration: number;
};
```

**"이런 것도 된다고?" 포인트:**
- 신의 명령 후 마을 전체가 어떻게 반응했는지 몽타주로 보여줌

#### 6.8.5 Freeze

프리즈 프레임 (결정적 순간).

```typescript
type FreezeEffect = {
  type: 'freeze';
  params: {
    grayscale: boolean;
    zoomTo?: { x: number; y: number };
    caption?: string;
  };
  duration: number;
};
```

---

## 7. Zone System

### 7.1 Zone Definition

```
Zone1 = { npc | Manhattan(npc.position, player.position) ≤ 5 }
Zone2 = { npc | Manhattan(npc.position, player.position) > 5 }
```

### 7.2 Zone Behavior Matrix

| Behavior | Zone1 | Zone2 |
|----------|-------|-------|
| Position Update | ✅ Every tick | ✅ Every tick |
| Needs Update | ✅ Every tick | ✅ Every tick |
| Schedule Following | ✅ | ✅ |
| Mind Status | `active` | `frozen` |
| LLM Reactions | ✅ Triggered | ❌ Never |
| Memory Buffer | Processed | Accumulating |
| UI Bubbles | ✅ Shown | ❌ Hidden |
| Detailed Animations | ✅ | ❌ (Simple sprite) |

### 7.3 Zone Transition

```
Zone2 → Zone1:
1. Check distance change
2. If entered Zone1:
   a. Mark for hydrate
   b. Call npc.hydrate effect
   c. LLM generates: thought + memory consolidation
   d. Update mind.status = 'active'
   e. Clear memoryBuffer
   f. Maybe show arrival bubble
```

### 7.4 Memory Buffer (Zone2)

```typescript
// Cheap event pointers stored in Zone2
type EventPointer = {
  eventType: string;    // 'rain_started', 'saw_mayor', 'heard_thunder'
  tick: number;
  data: Record<string, unknown>;  // Minimal data
};

// On hydrate, LLM consolidates these into:
type Memory = {
  tick: number;
  summary: string;      // "비가 내리기 시작했고, 시장님을 봤다"
  emotion: EmotionType;
};
```

---

## 8. LLM Integration

### 8.1 LLM Effect Types

```typescript
// Effect declarations (MEL → Host)
type LLMEffects = 
  | { type: 'llm.parseIntent'; params: ParseIntentParams }
  | { type: 'npc.hydrate'; params: HydrateParams }
  | { type: 'npc.triggerReactions'; params: ReactionParams }
  | { type: 'prophet.interpret'; params: InterpretParams }
  | { type: 'prayer.generate'; params: GeneratePrayerParams };
```

### 8.2 Intent Parser

```typescript
interface ParseIntentParams {
  input: string;
  context: {
    weather: string;
    hour: number;
    nearbyNpcs: string[];
    reputation: { fear: number; mercy: number };
  };
  into: string;  // State path for result
}

// LLM Prompt Template
const INTENT_PARSER_PROMPT = `
당신은 신 시뮬레이션 게임의 명령어 파서입니다.
플레이어의 자연어 명령을 구조화된 인텐트로 변환하세요.

가능한 인텐트 타입:
- SMITE: 천벌 (targetId, power: 1-100)
- BLESS: 축복 (targetId, blessing: string)
- CHANGE_WEATHER: 날씨 변경 (weather: clear|rain|storm|fog)
- SPEAK: 신탁 전달 (targetId, message: string)
- GRANT_PRAYER: 기도 수락 (prayerId)
- DENY_PRAYER: 기도 거부 (prayerId)
- UNKNOWN: 인식 불가

현재 상황:
- 날씨: {{weather}}
- 시간: {{hour}}시
- 근처 NPC: {{nearbyNpcs}}
- 평판: 공포 {{fear}}, 자비 {{mercy}}

플레이어 입력: "{{input}}"

JSON 형식으로만 응답하세요.
`;
```

### 8.3 NPC Hydrate

```typescript
interface HydrateParams {
  npcId: string;
  reason: 'zone_transition' | 'player_inspection' | 'divine_message' | 'triggered';
  forceActive: boolean;
}

// LLM Prompt Template
const HYDRATE_PROMPT = `
당신은 {{npcName}}({{npcRole}})입니다.

최근 경험:
{{#each memoryBuffer}}
- {{this.eventType}} ({{this.tick}}틱 전)
{{/each}}

현재 상태:
- 배고픔: {{hunger}}/100
- 피로: {{fatigue}}/100
- 기분: {{mood}}/100

신에 대한 인식: {{reputationTitle}}

질문:
1. 지금 무슨 생각을 하고 있나요? (한 문장)
2. 최근 경험을 어떻게 기억하나요? (한 문장)
3. 말풍선에 뭐라고 말할까요? (선택적, 짧게)

JSON 형식:
{
  "thought": "...",
  "memorySummary": "...",
  "bubbleText": "..." | null,
  "emotion": "joy|fear|anger|sadness|surprise|neutral"
}
`;
```

### 8.4 NPC Reactions

```typescript
interface ReactionParams {
  eventType: string;
  sourceNpcId: string | null;
  affectedNpcIds: string[];
  data: Record<string, unknown>;
}

// Host batches reactions to minimize LLM calls
// Only Zone1 NPCs get LLM reactions
// Uses template responses for common reactions
```

### 8.5 Prophet Interpretation

```typescript
interface InterpretParams {
  eventType: string;
  targetName: string;
  reputation: { fear: number; mercy: number };
}

// LLM Prompt Template
const PROPHET_PROMPT = `
당신은 마을의 예언자입니다. 신의 행동을 해석하여 마을 사람들에게 전달합니다.

방금 일어난 일: {{eventType}} (대상: {{targetName}})
현재 신의 평판: 공포 {{fear}}, 자비 {{mercy}}

한 문장으로 이 사건을 극적으로 해석하세요.
예언자스러운 말투를 사용하세요.

예시:
- "보라! 신께서 탐욕을 벌하셨도다!"
- "자비로운 신께서 겸손한 자를 보살피시도다."
- "하늘이 노하셨으니, 회개하라!"
`;
```

### 8.6 Prayer Generation

```typescript
interface GeneratePrayerParams {
  eligibleNpcIds: string[];
  reputation: { fear: number; mercy: number };
  into: string;
}

// Uses templates + occasional LLM for variety
const PRAYER_TEMPLATES = {
  blessing: [
    "{{name}}의 사업이 번창하게 해주소서",
    "{{name}}의 병든 가족을 치료해주소서"
  ],
  punishment: [
    "{{enemy}}에게 천벌을 내려주소서",
    "도둑을 잡아주소서"
  ],
  weather: [
    "비를 내려주소서, 가뭄이 심합니다",
    "폭풍을 멈춰주소서"
  ]
};
```

### 8.7 Cost Budget

```typescript
const LLM_BUDGET = {
  maxCallsPerTick: 2,
  maxCallsPerMinute: 10,
  priorityQueue: [
    'divine_message',      // Highest
    'player_inspection',
    'triggered_reaction',
    'zone_transition',
    'prophet_interpretation',
    'prayer_generation'    // Lowest
  ]
};
```

---

## 9. UI Components

### 9.1 Component Tree

```
<GodsDesktopProvider>
  ├── <TopBar>
  │   ├── <TimeDisplay />
  │   ├── <WeatherIndicator />
  │   ├── <ReputationBadge />
  │   └── <ZoneCounter />
  │
  ├── <MainLayout>
  │   ├── <WorldGrid>
  │   │   ├── <GridCell /> × (width × height)
  │   │   ├── <NpcSprite /> × npcCount
  │   │   ├── <PlayerCursor />
  │   │   ├── <Zone1Overlay />
  │   │   └── <EffectLayer />
  │   │
  │   ├── <Inspector>
  │   │   ├── <NpcInfo />
  │   │   ├── <MindStatus />
  │   │   ├── <MemoryList />
  │   │   └── <RelationshipGraph />
  │   │
  │   └── <PrayerQueue>
  │       └── <PrayerCard /> × prayerCount
  │
  ├── <Console>
  │   ├── <ConsoleHistory />
  │   ├── <ConsoleInput />
  │   └── <CostIndicator />
  │
  └── <TimelineTree>
      ├── <TimelineNode /> × snapshotCount
      └── <ForkBranch /> × forkCount
</GodsDesktopProvider>
```

### 9.2 Key Components

#### WorldGrid

```tsx
// components/WorldGrid.tsx
'use client';

import { useValue, useActions } from '@manifesto-ai/react';
import { cn } from '@/lib/utils';

export function WorldGrid() {
  const grid = useValue('grid');
  const player = useValue('player');
  const npcs = useValue('npcs');
  const zone1NpcIds = useValue('computed.zone1NpcIds');
  const effectQueue = useValue('effectQueue');
  
  return (
    <div className="relative">
      {/* Grid */}
      <div 
        className="grid gap-px bg-slate-800"
        style={{
          gridTemplateColumns: `repeat(${grid.width}, 2rem)`,
          gridTemplateRows: `repeat(${grid.height}, 2rem)`,
        }}
      >
        {Array.from({ length: grid.width * grid.height }).map((_, i) => {
          const x = i % grid.width;
          const y = Math.floor(i / grid.width);
          const isZone1 = isInZone1(x, y, player);
          
          return (
            <GridCell 
              key={i} 
              x={x} 
              y={y} 
              isZone1={isZone1}
            />
          );
        })}
      </div>
      
      {/* NPCs */}
      {Object.values(npcs).map(npc => (
        <NpcSprite 
          key={npc.id}
          npc={npc}
          isInZone1={zone1NpcIds.includes(npc.id)}
        />
      ))}
      
      {/* Player Cursor */}
      <PlayerCursor x={player.x} y={player.y} />
      
      {/* Effect Layer */}
      <EffectLayer effects={effectQueue} />
    </div>
  );
}
```

#### Console

```tsx
// components/Console.tsx
'use client';

import { useState } from 'react';
import { useValue, useActions } from '@manifesto-ai/react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

export function Console() {
  const [input, setInput] = useState('');
  const history = useValue('console.history');
  const pending = useValue('console.pending');
  const { dispatch } = useActions();
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || pending) return;
    
    dispatch({ type: 'console.submit', input: { rawInput: input } });
    setInput('');
  };
  
  return (
    <div className="flex flex-col h-64 bg-slate-900 border-t border-slate-700">
      <ScrollArea className="flex-1 p-4 font-mono text-sm">
        {history.map(line => (
          <ConsoleLine key={line.id} line={line} />
        ))}
        {pending && (
          <div className="text-yellow-500 animate-pulse">
            [System] Parsing intent...
          </div>
        )}
      </ScrollArea>
      
      <form onSubmit={handleSubmit} className="p-2 border-t border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-green-500 font-mono">GOD_MODE &gt;</span>
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={!!pending}
            className="flex-1 bg-transparent border-none font-mono"
            placeholder="명령을 입력하세요..."
          />
        </div>
      </form>
    </div>
  );
}

function ConsoleLine({ line }: { line: ConsoleLine }) {
  const colors = {
    input: 'text-white',
    system: 'text-slate-400',
    intent: 'text-cyan-400',
    patch: 'text-green-400',
    effect: 'text-purple-400',
    error: 'text-red-400',
  };
  
  return (
    <div className={cn('flex items-center gap-2', colors[line.type])}>
      <span>{line.content}</span>
      {line.llmCost && (
        <span className="text-yellow-500 text-xs">
          💸 ${line.llmCost.toFixed(4)}
        </span>
      )}
    </div>
  );
}
```

#### Inspector

```tsx
// components/Inspector.tsx
'use client';

import { useValue } from '@manifesto-ai/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function Inspector() {
  const selectedNpc = useValue('computed.selectedNpc');
  
  if (!selectedNpc) {
    return (
      <Card className="w-80">
        <CardContent className="p-6 text-center text-slate-500">
          NPC를 클릭하여 자세히 보기
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getRoleEmoji(selectedNpc.role)}
          {selectedNpc.name}
          <Badge variant={selectedNpc.mind.status === 'active' ? 'default' : 'secondary'}>
            {selectedNpc.mind.status === 'active' ? '🧠 ACTIVE' : '❄️ FROZEN'}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Position */}
        <div className="text-sm text-slate-500">
          위치: ({selectedNpc.position.x}, {selectedNpc.position.y})
        </div>
        
        {/* Needs */}
        <div className="space-y-2">
          <NeedBar label="배고픔" value={selectedNpc.needs.hunger} color="orange" />
          <NeedBar label="피로" value={selectedNpc.needs.fatigue} color="blue" />
          <NeedBar label="기분" value={selectedNpc.needs.mood} color="green" />
        </div>
        
        {/* Thought */}
        {selectedNpc.mind.thought && (
          <div className="p-3 bg-slate-800 rounded-lg">
            <div className="text-xs text-slate-500 mb-1">💭 현재 생각</div>
            <div className="text-sm italic">"{selectedNpc.mind.thought}"</div>
          </div>
        )}
        
        {/* Memory Buffer (if frozen) */}
        {selectedNpc.mind.status === 'frozen' && selectedNpc.memoryBuffer.length > 0 && (
          <div className="p-3 bg-slate-800 rounded-lg">
            <div className="text-xs text-slate-500 mb-1">
              📦 쌓인 경험 ({selectedNpc.memoryBuffer.length})
            </div>
            <div className="text-xs text-slate-400">
              다가가면 정리됩니다...
            </div>
          </div>
        )}
        
        {/* Memories */}
        {selectedNpc.memories.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 mb-2">📜 기억</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {selectedNpc.memories.slice(-5).map((memory, i) => (
                <div key={i} className="text-xs p-2 bg-slate-800 rounded">
                  <span className="mr-1">{getEmotionEmoji(memory.emotion)}</span>
                  {memory.summary}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 9.3 Effect Layer Implementation

```tsx
// components/EffectLayer.tsx
'use client';

import { useEffect, useState } from 'react';
import { useValue, useActions } from '@manifesto-ai/react';
import { motion, AnimatePresence } from 'framer-motion';

export function EffectLayer() {
  const effectQueue = useValue('effectQueue');
  const { dispatch } = useActions();
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {effectQueue.map(effect => (
          <EffectRenderer 
            key={effect.id} 
            effect={effect}
            onComplete={() => {
              dispatch({ type: 'ui.consumeEffect', input: { effectId: effect.id } });
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function EffectRenderer({ effect, onComplete }: { effect: UIEffect; onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, effect.duration);
    return () => clearTimeout(timer);
  }, [effect.duration, onComplete]);
  
  switch (effect.type) {
    case 'flash':
      return <FlashEffect params={effect.params} duration={effect.duration} />;
    case 'shake':
      return <ShakeEffect params={effect.params} duration={effect.duration} />;
    case 'lightning':
      return <LightningEffect params={effect.params} duration={effect.duration} />;
    case 'bubble':
      return <BubbleEffect params={effect.params} duration={effect.duration} />;
    case 'blessing':
      return <BlessingEffect params={effect.params} duration={effect.duration} />;
    // ... more effect renderers
    default:
      return null;
  }
}

// Example: Flash Effect
function FlashEffect({ params, duration }: { params: any; duration: number }) {
  return (
    <motion.div
      className="absolute inset-0"
      style={{ backgroundColor: params.color }}
      initial={{ opacity: params.opacity }}
      animate={{ opacity: 0 }}
      transition={{ duration: duration / 1000, ease: params.easing || 'easeOut' }}
    />
  );
}

// Example: Lightning Effect
function LightningEffect({ params, duration }: { params: any; duration: number }) {
  const cellSize = 32; // 2rem
  const x = params.x * cellSize + cellSize / 2;
  const y = params.y * cellSize + cellSize / 2;
  
  return (
    <motion.svg
      className="absolute"
      style={{ left: x - 50, top: 0 }}
      width="100"
      height={y + 50}
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: duration / 1000 }}
    >
      <motion.path
        d={generateLightningPath(50, 0, 50, y)}
        stroke={params.color || '#00BFFF'}
        strokeWidth={3}
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.1 }}
      />
      {/* Glow effect */}
      <motion.circle
        cx={50}
        cy={y}
        r={20}
        fill={params.color || '#00BFFF'}
        initial={{ opacity: 0.8, scale: 1 }}
        animate={{ opacity: 0, scale: 3 }}
        transition={{ duration: 0.3 }}
      />
    </motion.svg>
  );
}

// Example: Bubble Effect
function BubbleEffect({ params, duration }: { params: any; duration: number }) {
  const npcs = useValue('npcs');
  const npc = npcs[params.npcId];
  if (!npc) return null;
  
  const cellSize = 32;
  const x = npc.position.x * cellSize;
  const y = npc.position.y * cellSize - 40;
  
  return (
    <motion.div
      className="absolute bg-white rounded-lg px-3 py-2 shadow-lg"
      style={{ left: x, top: y }}
      initial={{ opacity: 0, y: 10, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <span className="mr-1">{getEmotionEmoji(params.emotion)}</span>
      {params.text}
      {/* Speech bubble tail */}
      <div className="absolute bottom-0 left-4 transform translate-y-full">
        <div className="border-8 border-transparent border-t-white" />
      </div>
    </motion.div>
  );
}
```

---

## 10. Timeline System

### 10.1 Snapshot Storage

```typescript
interface TimelineNode {
  id: string;
  parentId: string | null;
  tick: number;
  snapshotHash: string;  // For verification
  events: string[];      // Event summaries
  badges: TimelineBadge[];
}

type TimelineBadge = 'miracle' | 'weather' | 'dialogue' | 'death' | 'birth';
```

### 10.2 Timeline Operations

```typescript
// Effect handlers
const timelineEffects = {
  'timeline.createSnapshot': async (params) => {
    const hash = computeSnapshotHash(currentSnapshot);
    const node: TimelineNode = {
      id: generateId(),
      parentId: currentTimeline.currentId,
      tick: params.tick,
      snapshotHash: hash,
      events: extractSignificantEvents(params.significantEvents),
      badges: determineBadges(params.significantEvents),
    };
    
    await storage.saveSnapshot(node.id, currentSnapshot);
    
    return [
      { op: 'set', path: `timeline.snapshots.${node.id}`, value: node },
      { op: 'set', path: 'timeline.currentId', value: node.id },
    ];
  },
  
  'timeline.loadSnapshot': async (params) => {
    const snapshot = await storage.loadSnapshot(params.nodeId);
    // Return entire snapshot replacement
    return [
      { op: 'set', path: 'data', value: snapshot.data },
      { op: 'set', path: 'computed', value: snapshot.computed },
    ];
  },
  
  'timeline.createFork': async (params) => {
    const fork: Fork = {
      id: generateId(),
      fromNodeId: params.fromNodeId,
      reason: params.reason,
      createdAt: Date.now(),
    };
    
    return [
      { op: 'set', path: `timeline.forks.${fork.id}`, value: fork },
    ];
  },
};
```

### 10.3 Timeline UI

```tsx
// components/TimelineTree.tsx
'use client';

import { useValue, useActions } from '@manifesto-ai/react';

export function TimelineTree() {
  const timeline = useValue('timeline');
  const { dispatch } = useActions();
  
  const nodes = Object.values(timeline.snapshots);
  const tree = buildTree(nodes, timeline.forks);
  
  return (
    <div className="p-4 bg-slate-900 border-l border-slate-700 w-64 overflow-auto">
      <h3 className="text-sm font-bold mb-4 text-slate-400">Timeline</h3>
      
      <div className="relative">
        {renderTree(tree, timeline.currentId, (nodeId) => {
          dispatch({ type: 'timeline.jumpTo', input: { nodeId } });
        })}
      </div>
    </div>
  );
}

function TimelineNodeComponent({ 
  node, 
  isCurrent, 
  onClick 
}: { 
  node: TimelineNode; 
  isCurrent: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-8 h-8 rounded-full border-2 flex items-center justify-center",
        isCurrent 
          ? "border-blue-500 bg-blue-500/20" 
          : "border-slate-600 bg-slate-800 hover:border-slate-400"
      )}
    >
      {node.badges.map(badge => getBadgeEmoji(badge)).join('')}
    </button>
  );
}
```

---

## Appendix A: File Structure

```
gods-desktop/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── providers.tsx
│
├── components/
│   ├── ui/                    # shadcn components
│   ├── Console.tsx
│   ├── WorldGrid.tsx
│   ├── Inspector.tsx
│   ├── TimelineTree.tsx
│   ├── PrayerQueue.tsx
│   ├── EffectLayer.tsx
│   └── effects/
│       ├── FlashEffect.tsx
│       ├── ShakeEffect.tsx
│       ├── LightningEffect.tsx
│       ├── BubbleEffect.tsx
│       └── ...
│
├── domain/
│   ├── schema.ts              # Zod schema
│   ├── domain.mel             # MEL source
│   └── compiled.json          # Compiled schema
│
├── effects/
│   ├── llm/
│   │   ├── parseIntent.ts
│   │   ├── hydrate.ts
│   │   └── prophet.ts
│   ├── ui/
│   │   └── queueEffect.ts
│   ├── npc/
│   │   ├── processAllTick.ts
│   │   └── checkZoneTransitions.ts
│   └── timeline/
│       ├── createSnapshot.ts
│       └── loadSnapshot.ts
│
├── lib/
│   ├── manifesto.ts           # Manifesto setup
│   ├── llm.ts                 # OpenAI client
│   └── utils.ts
│
└── public/
    ├── sounds/
    └── sprites/
```

---

## Appendix B: Effect Quick Reference

| Effect | Category | "와우" Level | Cost |
|--------|----------|-------------|------|
| `flash` | Visual | ⭐⭐ | $0 |
| `shake` | Visual | ⭐⭐ | $0 |
| `lightning` | Visual | ⭐⭐⭐ | $0 |
| `blessing` | Visual | ⭐⭐⭐ | $0 |
| `slowMotion` | Dramatic | ⭐⭐⭐⭐ | $0 |
| `splitScreen` | Dramatic | ⭐⭐⭐⭐⭐ | $0 |
| `eclipse` | Weather | ⭐⭐⭐⭐⭐ | $0 |
| `bloodRain` | Particle | ⭐⭐⭐⭐⭐ | $0 |
| `divineVoice` | Text | ⭐⭐⭐⭐ | $0 |
| `rewind` | Timeline | ⭐⭐⭐⭐ | $0 |
| `montage` | Timeline | ⭐⭐⭐⭐⭐ | $0 |
| `prophecy` | Text | ⭐⭐⭐ | ~$0.001 (LLM) |

---

*End of Technical Specification v0.1.0*
