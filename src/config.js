// ============================================================
// Global tunables. Import these anywhere instead of magic numbers.
// ============================================================
export const CHUNK_SIZE   = 16;    // blocks along X and Z per chunk
export const CHUNK_HEIGHT = 128;   // blocks along Y (bump to 256 for taller worlds; costs perf)
export const SEA_LEVEL    = 46;    // water fills up to this Y
export const RENDER_DISTANCE = 4;  // chunks loaded in each direction around the player
export const WORLD_SEED   = 1337;  // change for a different world

export const REACH = 5;            // max block-interaction distance (Minecraft creative ≈ 5)
export const GRAVITY = 26;         // blocks / s^2
export const JUMP_SPEED = 8.6;     // initial upward velocity on jump
export const WALK_SPEED = 4.3;     // blocks / s (Minecraft walk ≈ 4.317)
export const SPRINT_MULT = 1.3;    // Minecraft sprint ≈ 1.3x walk
export const SNEAK_MULT = 0.3;     // Minecraft sneak ≈ 0.3x walk
export const FLY_VSPEED = 8.0;     // vertical fly speed (Space up / Shift down)
export const FLY_HMULT = 2.2;      // horizontal speed multiplier while flying
export const DAY_LENGTH = 600;     // seconds per full day/night cycle (Minecraft = 1200)
