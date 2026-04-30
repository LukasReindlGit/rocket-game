# Game Ideas

Each entry is a user story. Use this file to groom and prioritize what gets built next.

**Statuses:** `[live]` · `[building]` · `[backlog]` · `[idea]`

---

## [live] 10 Seconds Challenge

**As a** lobby visitor,  
**I want to** press a buzzer, wait what feels like exactly 10 seconds, and press it again,  
**so that** I can test my internal sense of time and see how I rank against others.

**Acceptance criteria:**
- Timer runs invisibly after START press
- Score = |elapsed − 10 000 ms| (lower is better)
- Rocket animation signals result (great / meh / fail)
- QR code leads to survey form; score recorded after form submit
- Leaderboard visible in sidebar (all / today / this week)
- Kiosk leaderboard display at `/leaderboard`

---

## [building] Flappy Fivy

**As a** lobby visitor,  
**I want to** tap to flap a bird through gaps between pipes,  
**so that** I can challenge my reflexes and compete for the highest score on the leaderboard.

**Acceptance criteria:**
- Gravity pulls the bird down; each tap applies upward velocity
- Pipes scroll in from the right with randomised gap heights
- Score = number of pipe pairs passed without collision
- Collision with a pipe or the floor/ceiling ends the game
- Game over screen shows the score and prompts for a nickname
- Score is submitted and the top 10 leaderboard is shown immediately
- "Play Again" returns to the start screen without reloading
- Bird graphic = two swappable image files (`bird-up.svg`, `bird-down.svg`)
- Pipe graphic = one swappable image file (`pipe.svg`)
- Replacing any asset file is sufficient to retheme the game visually
- Touch-first controls (tap anywhere); also works with mouse click and spacebar
- Optimised for iPad in landscape orientation

---

## [backlog] Reaction Tap

**As a** lobby visitor,  
**I want to** tap the screen the instant a signal appears,  
**so that** I can measure and rank my raw reaction speed in milliseconds.

**Acceptance criteria:**
- Random delay (1–5 s) before a large coloured flash fills the screen
- Player taps as fast as possible after the signal
- Score = reaction time in ms (lower is better)
- False-start (tapping before signal) adds a penalty or disqualifies
- Leaderboard shows top times with nickname

---

## [backlog] Memory Match

**As a** lobby visitor,  
**I want to** flip cards to find matching pairs from memory,  
**so that** I can test my short-term memory under a time limit.

**Acceptance criteria:**
- 4×4 grid of face-down cards (8 pairs)
- Cards flip on tap; non-matching pairs flip back after ~1 s
- Score = number of pairs found within 60 s (or time remaining as tiebreaker)
- Card face images are swappable (company-branded assets possible)
- Works with touch (iPad primary)

---

## [backlog] Type Racer (Lobby Edition)

**As a** lobby visitor,  
**I want to** type a short phrase as fast and accurately as possible,  
**so that** I can see my WPM score and challenge colleagues.

**Acceptance criteria:**
- Short phrase (15–25 words) shown; player types on an on-screen or physical keyboard
- Score = WPM with accuracy penalty
- Phrases are configurable (company trivia, product names, etc.)
- Works on iPad with Bluetooth keyboard; soft keyboard fallback acceptable

---

## [idea] Whack-a-Mole

**As a** lobby visitor,  
**I want to** tap targets as they pop up and disappear,  
**so that** I can show off my speed and coordination.

- Targets appear at random positions, shrink and vanish after ~800 ms
- Score = number of successful hits in 30 s
- Theme: replace mole sprite with company mascot or product icon

---

## [idea] Colour Sorting Puzzle

**As a** lobby visitor,  
**I want to** sort coloured balls into matching tubes,  
**so that** I can solve the puzzle as fast as possible and rank on the leaderboard.

- Classic water-sort / ball-sort puzzle
- Score based on time to completion
- Difficulty increases with more colours / tubes

---

## [idea] Endless Runner

**As a** lobby visitor,  
**I want to** dodge obstacles in an automatically scrolling world,  
**so that** I can see how far I can get before crashing.

- One-button control (tap to jump, long-press to double-jump)
- Score = distance travelled
- Background and character fully swappable via asset files

---

## Grooming notes

- Prioritise games that work well on touchscreen with no tutorial needed
- Keep each game's max session length under 2 minutes
- All games share the same leaderboard infrastructure (nickname + score per game ID)
- Asset replaceability (swap images to retheme) is a must for any new game
