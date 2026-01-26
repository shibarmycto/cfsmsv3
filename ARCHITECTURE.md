# Roleplay Game Architecture - Enhanced Features

## Component Hierarchy

```
GameWorld (Main Game Loop)
│
├── 🎮 Core Systems
│   ├── Movement System
│   │   ├── WASD/Arrow input detection
│   │   ├── Position updates
│   │   └── Camera tracking
│   │
│   ├── Animation System (NEW)
│   │   ├── Animation State Tracking
│   │   │   ├── Idle
│   │   │   ├── Walking
│   │   │   ├── Running
│   │   │   └── Emoting
│   │   │
│   │   ├── Walk Cycle Engine
│   │   │   ├── 4-frame animation
│   │   │   ├── Speed-based timing
│   │   │   └── Limb interpolation
│   │   │
│   │   └── Emote System (NEW)
│   │       ├── 6 emote types
│   │       ├── Emoji indicators
│   │       └── Auto-reset timer
│   │
│   ├── Proximity System (NEW)
│   │   ├── Distance calculation (300px range)
│   │   ├── Real-time player detection
│   │   └── Sorting by distance
│   │
│   └── Vehicle System
│       ├── Physics simulation
│       ├── Input handling
│       └── Position tracking
│
├── 🎨 Visual Components
│   ├── PlayerSprite (ENHANCED)
│   │   ├── Enhanced SVG rendering
│   │   ├── Animation state props
│   │   ├── Emote display
│   │   └── Drop shadows
│   │
│   ├── VehicleSprite (ENHANCED)
│   │   ├── Better graphics
│   │   ├── Vehicle shadows
│   │   └── Rotation effects
│   │
│   ├── GameWorld Rendering
│   │   ├── Ground tiles
│   │   ├── Road system
│   │   ├── Properties
│   │   └── Grass details
│   │
│   ├── EmoteSystem (NEW)
│   │   ├── Emote button
│   │   ├── Selection menu
│   │   └── Emote storage
│   │
│   └── ProximityInteraction (NEW)
│       ├── Player list
│       ├── Distance display
│       └── Chat buttons
│
├── 🎮 UI Systems
│   ├── GameHUD (Character stats)
│   ├── GameChat (Chat system)
│   ├── GameMenu (Jobs, bank, etc)
│   ├── GameChatSystem (Real-time chat)
│   ├── VehicleMenu
│   ├── TaxiJobMenu
│   └── Other specialized menus
│
└── 🔄 Data Management
    ├── Character state
    ├── Other players sync
    ├── Vehicle state
    ├── Property data
    └── Real-time updates (Supabase)
```

---

## Data Flow Diagram

```
User Input (WASD, Click)
    │
    ▼
[Input Handlers]
    │
    ├─ Movement keys → [Movement System]
    │                       │
    │                       ▼
    │                  [Position Update]
    │                       │
    │                       ▼
    │                  [Animation State]
    │                       │
    │          ┌────────────┴────────────┐
    │          │                         │
    │          ▼                         ▼
    │      [Walk Cycle]            [Movement Vector]
    │          │                         │
    │          └────────────┬────────────┘
    │                       │
    │                       ▼
    │                  [PlayerSprite]
    │
    ├─ Emote button → [EmoteSystem]
    │                       │
    │                       ▼
    │                  [Emote selection]
    │                       │
    │                       ▼
    │                  [Animation State = Emote]
    │                       │
    │                       ▼
    │                  [Display Emote + Timer]
    │                       │
    │                       ▼
    │                  [Reset after 2s]
    │
    └─ Movement (for proximity)
                            │
                            ▼
                      [Position Update]
                            │
                            ▼
                    [Calculate Distances]
                            │
                            ▼
                   [Filter within 300px]
                            │
                            ▼
                      [ProximityInteraction]

Game Loop (Every Frame @ 60fps)
    │
    ├─ Update animation frame
    ├─ Render PlayerSprite with animation state
    ├─ Render nearby players
    ├─ Render vehicles with shadows
    ├─ Update camera position
    └─ Sync to server (every 100ms)
```

---

## Animation State Machine

```
                    [IDLE]
                      △
                      │
         No Input  ◄──┴──► Movement Keys Pressed
                      │
                      ▼
           ┌──────────────────┐
           │  Moving?         │
           └─────────┬────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    Slow Movement        Fast Movement
         │                       │
         ▼                       ▼
    [WALKING]                [RUNNING]
     Animation              Animation
     150ms/frame            75ms/frame
         │                       │
         └───────────┬───────────┘
                     │
              Stop Moving
                     │
                     ▼
                  [IDLE]

     [EMOTE BUTTON CLICK]
              │
              ▼
         [EMOTING]
         Display emoji
         2 second timer
              │
              ▼
         Timer expires
              │
              ▼
         [IDLE]
```

---

## Proximity Detection System

```
Player Position
    │
    ▼
[For Each Other Player]
    │
    ├─ Calculate distance
    │   Distance = √[(x₂-x₁)² + (y₂-y₁)²]
    │
    ├─ Compare to 300px threshold
    │
    ├─ Filter nearby players
    │
    └─ Sort by distance (closest first)
            │
            ▼
    [ProximityInteraction Panel]
         Shows:
    - Player name
    - Distance in pixels
    - Chat button
```

---

## Performance Optimization

```
Game Loop (RequestAnimationFrame)
    │
    ├─ High Frequency (60fps)
    │   ├─ Input detection
    │   ├─ Position calculation
    │   ├─ Animation rendering
    │   └─ Sprite rendering
    │
    └─ Medium Frequency (Every 100ms)
        └─ Server sync
            ├─ Position update
            └─ Vehicle update

Cache & Efficiency:
    - Animation frame numbers cached
    - Position references (useRef)
    - Proximity calculations optimized
    - Z-index based on Y position
```

---

## File Dependencies

```
GameWorld.tsx (Main Component)
    │
    ├── imports ──→ PlayerSprite.tsx (Render player)
    │
    ├── imports ──→ VehicleSprite.tsx (Render vehicles)
    │
    ├── imports ──→ EmoteSystem.tsx (NEW - Emote button)
    │               │
    │               └── uses Button component
    │
    ├── imports ──→ ProximityInteraction.tsx (NEW - Nearby players)
    │               │
    │               └── uses Button component
    │
    ├── imports ──→ GameHUD.tsx (Character stats)
    │
    ├── imports ──→ GameChatSystem.tsx (Chat)
    │
    ├── imports ──→ GameMenu.tsx (Menus)
    │
    └── other game components...

PlayerSprite.tsx (Component)
    │
    ├── Receives props:
    │   ├── player (position, colors, etc)
    │   ├── isCurrentPlayer (boolean)
    │   ├── animationState (NEW)
    │   ├── emoteType (NEW)
    │   └── direction (NEW)
    │
    └── Renders SVG with:
        ├── Base character shape
        ├── Animated limbs (arm/leg offset)
        ├── Emote emoji indicator
        └── Drop shadow
```

---

## State Management Overview

### GameWorld Component State:
```typescript
// Character data
const [character, setCharacter]           // Current player
const [otherPlayers, setOtherPlayers]     // Other online players

// Animation state (NEW)
const [playerAnimationState, setPlayerAnimationState]  // idle|walking|running|emote
const [playerEmote, setPlayerEmote]                     // Emote type
const [emoteTimeout, setEmoteTimeout]                   // Timer reference

// Proximity (NEW)
const [nearbyPlayers, setNearbyPlayers]   // Players within 300px

// Game state
const [currentVehicle, setCurrentVehicle]
const [keysPressed, setKeysPressed]
const [cameraOffset, setCameraOffset]
const [properties, setProperties]
const [vehicles, setVehicles]

// UI state
const [showChat, setShowChat]
const [showMenu, setShowMenu]
// ... other UI states
```

### Refs for Performance:
```typescript
const gameLoopRef                  // RAF loop ID
const lastUpdateRef                // Last server sync time
const positionRef                  // Current position (non-render)
const vehicleRef                   // Vehicle speed/rotation (non-render)
const lastMovementRef (NEW)        // For animation speed detection
```

---

## Animation Frame Rate

```
Character Walking:
    Frame 1: Left arm up, right leg back
    Frame 2: Arms neutral, legs neutral
    Frame 3: Left arm back, right leg forward
    Frame 4: Arms neutral, legs neutral
    
    Duration per cycle: 150ms × 4 = 600ms

Character Running:
    Same frames but faster:
    Duration per cycle: 75ms × 4 = 300ms

Emote:
    Display emoji for 2000ms
    Then reset to idle
```

---

## Server Sync Strategy

```
Client Side:
    - Move immediately on input (60fps)
    - Smooth animation locally
    - Update position ref
    
Every 100ms:
    - Check if changed significantly
    - Send position to server
    - Receive other players' updates

Server Side:
    - Store character positions
    - Broadcast to other players
    - Maintain game state
    
Result:
    - Responsive local gameplay
    - Real-time multiplayer updates
    - Efficient bandwidth usage
```

---

## Browser Compatibility

```
Tested & Optimized For:
✅ Chrome/Chromium (v90+)
✅ Edge (v90+)
✅ Firefox (v88+)
✅ Safari (v14+)

Uses:
- Modern CSS Grid/Flexbox
- CSS Transitions & Animations
- RequestAnimationFrame API
- SVG rendering
- Async/await
- ES2020+ features
```

---

This architecture ensures:
- ✅ Smooth 60fps gameplay
- ✅ Real-time multiplayer
- ✅ Responsive animations
- ✅ Efficient performance
- ✅ Clean code organization
- ✅ Extensible for future features
