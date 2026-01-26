# Quick Start Guide - Improved Roleplay Game

## What's New?

Your roleplay game now features **realistic character animations**, **improved visuals**, **emotes**, and **proximity-based player interactions** - similar to the One State game!

## Installation & Setup

### 1. Install Dependencies
```bash
cd /workspaces/cfsmsv3
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

The server will start on `http://localhost:5173`

### 3. Build for Production
```bash
npm run build
```

## How to Play

### Navigation Controls
- **WASD Keys** or **Arrow Keys** - Move your character
- **Shift + Movement** - Run faster (coming soon)
- **T or Enter** - Open chat
- **F** - Exit vehicle
- **ESC** - Close menus

### Using Emotes
1. Click the **Emote** button (bottom-left corner)
2. Choose from 6 different emotes:
   - 👋 Wave
   - 💃 Dance
   - 🎉 Celebrate
   - 🪑 Sit
   - 😴 Sleep
   - 😠 Angry
3. Your character will perform the emote for 2 seconds

### Interacting with Other Players
1. Move near another player (within 300px)
2. They'll appear in the **"Nearby Players"** panel at the top
3. Click the chat icon to message them
4. Use emotes to communicate non-verbally

### Using Vehicles
1. Click on any vehicle to enter it
2. Use arrow keys or WASD to drive
3. Press **F** to exit the vehicle
4. Vehicle has improved acceleration and turning

### Other Features
- **Jobs** - Click "Jobs" button to earn money
- **Bank** - Click "Bank" to manage funds
- **Chat** - Click "Chat" or press "T" to talk
- **Properties** - Click properties to view details
- **Exchange** - Convert credits/tokens

## Visual Improvements You'll See

✨ **Character Animation**: Your character walks and runs with animated limbs  
✨ **Better Sprites**: More detailed character and vehicle graphics  
✨ **Shadows**: Realistic shadows under characters and vehicles  
✨ **Smoother World**: Better terrain textures and road visibility  
✨ **Emote Indicators**: Floating emoji when performing emotes  
✨ **Name Tags**: Clearer, more visible player names  

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| WASD / Arrows | Move |
| T or Enter | Chat |
| F | Exit vehicle |
| ESC | Close menus |
| Click on NPC | Interact with property/vehicle |

## Troubleshooting

### Game doesn't start?
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npm run dev
```

### Performance issues?
- Close other browser tabs
- Check your internet connection
- Ensure you're on a modern browser (Chrome, Edge, Firefox)

### Character doesn't move?
- Click the game area to focus it
- Check that you're not in a menu (press ESC)
- Try refreshing the page

## Next Steps

You can enhance the game further by:

1. **Adding more emotes** - Edit `src/components/game/EmoteSystem.tsx`
2. **Customize movement speeds** - Change constants in `src/components/game/GameWorld.tsx`
3. **Add new animations** - Modify `src/components/game/PlayerSprite.tsx`
4. **Adjust proximity range** - Change PROXIMITY_RANGE in GameWorld
5. **Add weather effects** - Create a new weather system component
6. **Custom NPC characters** - Add NPCs with their own animations

## File Structure

```
src/components/game/
├── GameWorld.tsx              # Main game loop & logic
├── PlayerSprite.tsx           # Character animation & rendering
├── VehicleSprite.tsx          # Vehicle rendering
├── EmoteSystem.tsx            # NEW: Emote selection
├── ProximityInteraction.tsx   # NEW: Nearby player display
├── GameHUD.tsx                # UI elements
├── GameChat.tsx               # Chat system
└── ... (other game components)
```

## Performance Notes

- Built with Vite for fast development and production builds
- Smooth 60fps gameplay with optimized rendering
- Server sync every 100ms for real-time multiplayer
- Animations run at 60fps for smooth movement

## Tips for Best Experience

1. **Use Chrome/Edge** - Best performance
2. **Full Screen** - Better immersion
3. **Good Internet** - Smooth multiplayer sync
4. **Close Other Tabs** - More resources for the game

## Need Help?

Check the documentation files:
- `ROLEPLAY_IMPROVEMENTS.md` - Detailed feature list
- `BEFORE_AFTER_COMPARISON.md` - What changed and why

## Have Fun! 🎮

Your roleplay game is now ready with professional-quality animations and interactions!

Enjoy playing and customizing your game! 🚀
