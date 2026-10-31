# Saebom exercise catalog: draft for review

**Draft, updated Oct 16, 2026.** Claude's draft for the owner to review before Oct 26 (D34). Once reviewed, it becomes `supabase/seed.sql` on day 2. It applies D41–D54, including the owner's answers to the six review questions (see the end). What's left is a read-through of the exercises and cues.

**25 exercises:** 19 compound lifts across 7 movement patterns, plus 6 accessories. Main lifts (D41): back squat, bench press, deadlift and overhead press.

## Rules applied

- **Increments and minimum loads (§7, D53):** upper-body barbell +5 lb, lower-body barbell +10 lb, dumbbells +5 lb per hand, cables and machines +5 lb. Minimums: 45 lb barbell, 5 lb for everything else.
- **Dumbbell weights** are logged per hand. The goblet squat uses one dumbbell held in both hands, so it logs that dumbbell's weight.
- **Labels (D51):** each exercise names the muscle groups it works, which testers see on the exercise card, and the joints and areas it loads, which the plan uses for injuries. Each is graded **great** (the main work) or **light** (it helps or is loaded less).
- **Injured areas (D42, D46, D51):** "avoid completely" (train around) leaves out every exercise that loads the area, great or light. "Decreased intensity" (train light) keeps exercises that load it either way, except main lifts and barbell lifts, at 10–12 reps.
- **Swaps (D44):** same movement pattern only, and never _into_ a main lift (D41, confirmed). Every compound lift has at least one swap (D54).
- **New lifters (D52):** never given the deadlift; the Romanian deadlift is their hinge.
- **Dumbbells only (D43):** dumbbells plus an adjustable bench. The vertical-pull slot gets the chest-supported dumbbell row.
- **Cues:** 2–3 per exercise, 40 characters or fewer so they fit on a session card.

## Squat

### Back squat · **main lift**

`back_squat`

- **Works:** Legs (great), Back (light)
- **Loads:** Knee (great), Hip (great), Lower back (light), Ankle (light), Shoulder (light), Neck (light)
- **Equipment:** barbell · +10 lb · min 45 lb
- **Swaps:** `goblet_squat`, `leg_press`
- **Train it light:** no (main lift)
- **Cues:**
  1. Brace before you sit down
  2. Knees follow your toes
  3. Push the floor away to stand
- **Note:** Neck and shoulder are tagged light because the bar rests on the upper back.

### Goblet squat

`goblet_squat`

- **Works:** Legs (great), Core (light)
- **Loads:** Knee (great), Hip (great), Lower back (light), Ankle (light)
- **Equipment:** dumbbell · +5 lb · min 5 lb
- **Swaps:** `leg_press`
- **Train it light:** yes
- **Cues:**
  1. Hold the dumbbell at your chest
  2. Sit down between your heels
  3. Keep your chest tall
- **Note:** Uses one dumbbell held in both hands: log that dumbbell's weight.

### Leg press

`leg_press`

- **Works:** Legs (great)
- **Loads:** Knee (great), Hip (great), Lower back (light), Ankle (light)
- **Equipment:** machine · +5 lb · min 5 lb
- **Swaps:** `goblet_squat`
- **Train it light:** yes
- **Cues:**
  1. Feet flat, hip-width apart
  2. Stop before your hips curl up
  3. Don't lock your knees at the top
- **Note:** Lower back tagged light (owner's call): kept when the lower back is trained light, left out when it's trained around.

## Hinge

### Deadlift · **main lift**

`deadlift`

- **Works:** Back (great), Legs (light)
- **Loads:** Hip (great), Lower back (great), Knee (light)
- **Equipment:** barbell · +10 lb · min 45 lb
- **Swaps:** `romanian_deadlift`, `dumbbell_romanian_deadlift`
- **Train it light:** no (main lift)
- **Cues:**
  1. Bar over your midfoot, shins close
  2. Brace, then push the floor away
  3. Keep the bar against your legs
- **Note:** Never given to new lifters, who get the Romanian deadlift instead (D52). If small plates leave the bar low, raise it on blocks or plates to mid-shin.

### Romanian deadlift

`romanian_deadlift`

- **Works:** Legs (great), Back (light)
- **Loads:** Hip (great), Lower back (great)
- **Equipment:** barbell · +10 lb · min 45 lb
- **Swaps:** `dumbbell_romanian_deadlift`
- **Train it light:** no (barbell)
- **Cues:**
  1. Soft knees, push your hips back
  2. Slide the bar down your thighs
  3. Stop before your back rounds
- **Note:** Starts from standing, so the bar height never matters. The hinge for new lifters (D52).

### Dumbbell Romanian deadlift

`dumbbell_romanian_deadlift`

- **Works:** Legs (great), Back (light)
- **Loads:** Hip (great), Lower back (great)
- **Equipment:** dumbbell · +5 lb · min 5 lb
- **Swaps:** `romanian_deadlift`
- **Train it light:** yes
- **Cues:**
  1. Keep the dumbbells close to your legs
  2. Push your hips back, not down
  3. Stop before your back rounds

## Lunge

### Dumbbell reverse lunge

`dumbbell_reverse_lunge`

- **Works:** Legs (great), Core (light)
- **Loads:** Knee (great), Hip (great), Ankle (light)
- **Equipment:** dumbbell · +5 lb · min 5 lb
- **Swaps:** `dumbbell_split_squat`
- **Train it light:** yes
- **Cues:**
  1. Step back and drop the back knee
  2. Front knee stays over your foot
  3. Push through the front heel to stand

### Dumbbell split squat

`dumbbell_split_squat`

- **Works:** Legs (great)
- **Loads:** Knee (great), Hip (great), Ankle (light)
- **Equipment:** dumbbell · +5 lb · min 5 lb
- **Swaps:** `dumbbell_reverse_lunge`
- **Train it light:** yes
- **Cues:**
  1. Feet stay planted the whole set
  2. Lower straight down
  3. Front heel stays on the floor
- **Note:** Easier to balance than the lunge; a good first choice for new lifters.

## Horizontal push

### Bench press · **main lift**

`bench_press`

- **Works:** Chest (great), Arms (light)
- **Loads:** Shoulder (great), Elbow (light), Wrist (light)
- **Equipment:** barbell · +5 lb · min 45 lb
- **Swaps:** `dumbbell_bench_press`, `machine_chest_press`
- **Train it light:** no (main lift)
- **Cues:**
  1. Set the safety arms first
  2. Shoulder blades back and down
  3. Lower to mid-chest, then press

### Dumbbell bench press

`dumbbell_bench_press`

- **Works:** Chest (great), Arms (light)
- **Loads:** Shoulder (great), Elbow (light), Wrist (light)
- **Equipment:** dumbbell · +5 lb · min 5 lb
- **Swaps:** `machine_chest_press`
- **Train it light:** yes
- **Cues:**
  1. Shoulder blades back and down
  2. Elbows at about 45° from your sides
  3. Lower to chest level, then press

### Machine chest press

`machine_chest_press`

- **Works:** Chest (great), Arms (light)
- **Loads:** Shoulder (great), Elbow (light), Wrist (light)
- **Equipment:** machine · +5 lb · min 5 lb
- **Swaps:** `dumbbell_bench_press`
- **Train it light:** yes
- **Cues:**
  1. Handles at mid-chest height
  2. Shoulder blades against the pad
  3. Don't lock your elbows

## Vertical push

### Overhead press · **main lift**

`overhead_press`

- **Works:** Shoulders (great), Arms (light)
- **Loads:** Shoulder (great), Elbow (light), Wrist (light), Lower back (light)
- **Equipment:** barbell · +5 lb · min 45 lb
- **Swaps:** `seated_dumbbell_shoulder_press`, `machine_shoulder_press`
- **Train it light:** no (main lift)
- **Cues:**
  1. Squeeze your glutes, ribs down
  2. Move your head back, then through
  3. Finish with the bar over your midfoot
- **Note:** Lower back tagged light because it's done standing.

### Seated dumbbell shoulder press

`seated_dumbbell_shoulder_press`

- **Works:** Shoulders (great), Arms (light)
- **Loads:** Shoulder (great), Elbow (light), Wrist (light)
- **Equipment:** dumbbell · +5 lb · min 5 lb
- **Swaps:** `machine_shoulder_press`
- **Train it light:** yes
- **Cues:**
  1. Back flat against the bench
  2. Wrists stacked over your elbows
  3. Press up without arching
- **Note:** Needs an adjustable bench set upright.

### Machine shoulder press

`machine_shoulder_press`

- **Works:** Shoulders (great), Arms (light)
- **Loads:** Shoulder (great), Elbow (light), Wrist (light)
- **Equipment:** machine · +5 lb · min 5 lb
- **Swaps:** `seated_dumbbell_shoulder_press`
- **Train it light:** yes
- **Cues:**
  1. Handles start at shoulder height
  2. Back flat against the pad
  3. Press up without locking your elbows
- **Note:** Added in v2.8 so the vertical push always has a swap (D54).

## Horizontal pull

### Barbell row

`barbell_row`

- **Works:** Back (great), Arms (light)
- **Loads:** Shoulder (great), Elbow (light), Lower back (light), Hip (light)
- **Equipment:** barbell · +5 lb · min 45 lb
- **Swaps:** `one_arm_dumbbell_row`, `chest_supported_dumbbell_row`
- **Train it light:** no (barbell)
- **Cues:**
  1. Hinge until your torso is near 45°
  2. Pull the bar to your lower ribs
  3. Keep your back flat

### One-arm dumbbell row

`one_arm_dumbbell_row`

- **Works:** Back (great), Arms (light)
- **Loads:** Shoulder (great), Elbow (light)
- **Equipment:** dumbbell · +5 lb · min 5 lb
- **Swaps:** `chest_supported_dumbbell_row`
- **Train it light:** yes
- **Cues:**
  1. Hand and knee on the bench
  2. Pull the dumbbell to your hip
  3. Don't twist your torso

### Chest-supported dumbbell row

`chest_supported_dumbbell_row`

- **Works:** Back (great), Arms (light)
- **Loads:** Shoulder (great), Elbow (light)
- **Equipment:** dumbbell · +5 lb · min 5 lb
- **Swaps:** `one_arm_dumbbell_row`
- **Train it light:** yes
- **Cues:**
  1. Chest stays on the pad
  2. Drive your elbows back past your ribs
  3. Lower all the way down
- **Note:** Incline bench at about 30°. Fills the vertical-pull slot with dumbbells only (D43).

## Vertical pull

### Lat pulldown

`lat_pulldown`

- **Works:** Back (great), Arms (light)
- **Loads:** Shoulder (great), Elbow (light)
- **Equipment:** cable · +5 lb · min 5 lb
- **Swaps:** `single_arm_cable_pulldown`
- **Train it light:** yes
- **Cues:**
  1. Lock your thighs under the pad
  2. Pull the bar to your upper chest
  3. Control it back up

### Single-arm cable pulldown

`single_arm_cable_pulldown`

- **Works:** Back (great), Arms (light)
- **Loads:** Shoulder (great), Elbow (light)
- **Equipment:** cable · +5 lb · min 5 lb
- **Swaps:** `lat_pulldown`
- **Train it light:** yes
- **Cues:**
  1. Kneel or sit tall, cable overhead
  2. Pull your elbow down to your side
  3. Let your arm reach fully on the way up
- **Note:** Added in v2.8 so the vertical pull always has a swap (D54). Log the weight for one arm.

## Accessories (D45)

### Dumbbell curl

`dumbbell_curl` · biceps

- **Works:** Arms (great)
- **Loads:** Elbow (great), Wrist (light)
- **Equipment:** dumbbell · +5 lb · min 5 lb
- **Swaps:** none
- **Train it light:** yes
- **Cues:**
  1. Elbows stay at your sides
  2. No swinging
  3. Lower slowly

### Triceps pushdown

`triceps_pushdown` · triceps

- **Works:** Arms (great)
- **Loads:** Elbow (great), Wrist (light)
- **Equipment:** cable · +5 lb · min 5 lb
- **Swaps:** none
- **Train it light:** yes
- **Cues:**
  1. Elbows pinned to your sides
  2. Push down until your arms are straight
  3. Only your forearms move

### Dumbbell lateral raise

`dumbbell_lateral_raise` · side delts

- **Works:** Shoulders (great)
- **Loads:** Shoulder (great)
- **Equipment:** dumbbell · +5 lb · min 5 lb
- **Swaps:** none
- **Train it light:** yes
- **Cues:**
  1. Slight bend in your elbows
  2. Raise to shoulder height, no higher
  3. Lead with your elbows
- **Note:** Reps carry most of the progress here; the weight moves in 5 lb steps.

### Leg curl

`leg_curl` · hamstrings

- **Works:** Legs (great)
- **Loads:** Knee (great)
- **Equipment:** machine · +5 lb · min 5 lb
- **Swaps:** none
- **Train it light:** yes
- **Cues:**
  1. Line your knees up with the pivot
  2. Keep your hips down
  3. Lower slowly

### Leg extension

`leg_extension` · quads

- **Works:** Legs (great)
- **Loads:** Knee (great)
- **Equipment:** machine · +5 lb · min 5 lb
- **Swaps:** none
- **Train it light:** yes
- **Cues:**
  1. Line your knees up with the pivot
  2. Pause at the top
  3. Lower slowly

### Dumbbell calf raise

`dumbbell_calf_raise` · calves

- **Works:** Legs (great)
- **Loads:** Ankle (great)
- **Equipment:** dumbbell · +5 lb · min 5 lb
- **Swaps:** none
- **Train it light:** yes
- **Cues:**
  1. Stand tall, dumbbells at your sides
  2. Rise as high as you can
  3. Lower slowly to a full stretch

## Coverage check

How many exercises stay in each compound pattern for a full-gym tester who **avoids an area completely**. A 0 means the plan skips that slot. Computed from the data above.

| Avoided area         | Squat | Hinge | Lunge | H push | V push | H pull | V pull |
| -------------------- | ----- | ----- | ----- | ------ | ------ | ------ | ------ |
| None, full gym       | 3     | 3     | 2     | 3      | 3      | 3      | 2      |
| None, dumbbells only | 1     | 1     | 2     | 1      | 1      | 2      | 0      |
| Shoulder             | 2     | 3     | 2     | 0      | 0      | 0      | 0      |
| Elbow                | 3     | 3     | 2     | 0      | 0      | 0      | 0      |
| Wrist                | 3     | 3     | 2     | 0      | 0      | 3      | 2      |
| Neck                 | 2     | 3     | 2     | 3      | 3      | 3      | 2      |
| Lower back           | 0     | 0     | 2     | 3      | 2      | 2      | 2      |
| Hip                  | 0     | 0     | 0     | 3      | 3      | 2      | 2      |
| Knee                 | 0     | 2     | 0     | 3      | 3      | 3      | 2      |
| Ankle                | 0     | 3     | 0     | 3      | 3      | 3      | 2      |

With **decreased intensity** instead, the pattern stays in the plan using these exercises at 10–12 reps:

- **Shoulder:** Dumbbell bench press, Machine chest press, Seated dumbbell shoulder press, Machine shoulder press, One-arm dumbbell row, Chest-supported dumbbell row, Lat pulldown, Single-arm cable pulldown
- **Elbow:** Dumbbell bench press, Machine chest press, Seated dumbbell shoulder press, Machine shoulder press, One-arm dumbbell row, Chest-supported dumbbell row, Lat pulldown, Single-arm cable pulldown
- **Wrist:** Dumbbell bench press, Machine chest press, Seated dumbbell shoulder press, Machine shoulder press
- **Lower back:** Goblet squat, Leg press, Dumbbell Romanian deadlift
- **Hip:** Goblet squat, Leg press, Dumbbell Romanian deadlift, Dumbbell reverse lunge, Dumbbell split squat
- **Knee:** Goblet squat, Leg press, Dumbbell reverse lunge, Dumbbell split squat
- **Ankle:** Goblet squat, Leg press, Dumbbell reverse lunge, Dumbbell split squat

## Owner's answers to the review questions (Oct 16)

1. **Swaps into main lifts:** blocked, for safety. The coach can't move someone onto a heavy barbell lift it has no history for, because the checker couldn't verify a safe starting weight. Swaps out of a main lift are fine (D41).
2. **Leg press and the lower back:** tagged light. A tester who trains the lower back light keeps it; one who avoids the lower back completely doesn't get it (D51).
3. **Deadlifts:** never for new lifters, who start on the Romanian deadlift. Others are cued to raise the bar on blocks when small plates leave it low (D52).
4. **Weight steps:** 5 lb for cables and machines, as for dumbbells; the minimum load drops to 5 lb (D53).
5. **No-swap exercises:** the machine shoulder press and single-arm cable pulldown are added, so every compound lift has a swap (D54).
6. **Labels:** every exercise is labeled with the muscle groups it works and the areas it loads, each graded great or light. Injured testers choose decreased intensity or avoiding the area completely, and the plan adjusts (D51).
