// Starter exercise library (reference data). Instructions are general technique guidance — trainers can edit them.
export interface SeedExercise {
  slug: string;
  name: string;
  category: 'STRENGTH' | 'CARDIO' | 'MOBILITY' | 'STRETCH' | 'PLYOMETRIC' | 'CORE';
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  equipment: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  description: string;
  instructions: string[];
  commonMistakes: string[];
}

export const EXERCISES: SeedExercise[] = [
  {
    slug: 'barbell-back-squat', name: 'Barbell Back Squat', category: 'STRENGTH', difficulty: 'INTERMEDIATE', equipment: ['Barbell', 'Squat rack'],
    primaryMuscles: ['Quads', 'Glutes'], secondaryMuscles: ['Hamstrings', 'Core', 'Lower back'],
    description: 'The foundational lower-body strength lift.',
    instructions: ['Set the bar on your upper back (not your neck). Feet shoulder-width, toes turned out slightly.', 'Brace your core, chest proud, eyes forward.', 'Push hips back and bend knees together — sit down between your heels.', 'Lower until thighs are at least parallel to the floor, knees tracking over toes.', 'Drive through your whole foot to stand, squeezing glutes at the top.'],
    commonMistakes: ['Knees caving inward', 'Heels lifting off the floor', 'Rounding the lower back at the bottom'],
  },
  {
    slug: 'deadlift', name: 'Deadlift', category: 'STRENGTH', difficulty: 'INTERMEDIATE', equipment: ['Barbell'],
    primaryMuscles: ['Hamstrings', 'Glutes', 'Lower back'], secondaryMuscles: ['Traps', 'Lats', 'Forearms', 'Core'],
    description: 'A full posterior-chain pull from the floor.',
    instructions: ['Stand with the bar over mid-foot, feet hip-width.', 'Hinge at the hips, bend knees, and grip the bar just outside your legs.', 'Chest up, back flat, shoulders over the bar, arms straight.', 'Push the floor away — hips and shoulders rise together, bar stays close to your legs.', 'Stand tall and squeeze glutes. Lower by pushing hips back first, then bending knees.'],
    commonMistakes: ['Rounding the back', 'Bar drifting away from the legs', 'Jerking the bar off the floor'],
  },
  {
    slug: 'barbell-bench-press', name: 'Barbell Bench Press', category: 'STRENGTH', difficulty: 'BEGINNER', equipment: ['Barbell', 'Bench'],
    primaryMuscles: ['Chest'], secondaryMuscles: ['Triceps', 'Front delts'],
    description: 'The classic horizontal pressing movement.',
    instructions: ['Lie back with eyes under the bar, feet flat, shoulder blades pinched together.', 'Grip slightly wider than shoulders and unrack with straight arms.', 'Lower the bar under control to your mid-chest, elbows about 45° from your body.', 'Press the bar up and slightly back over your shoulders until arms are straight.', 'Keep your glutes on the bench and wrists stacked over elbows throughout.'],
    commonMistakes: ['Bouncing the bar off the chest', 'Flaring elbows to 90°', 'Lifting hips off the bench'],
  },
  {
    slug: 'overhead-press', name: 'Overhead Press', category: 'STRENGTH', difficulty: 'INTERMEDIATE', equipment: ['Barbell'],
    primaryMuscles: ['Shoulders'], secondaryMuscles: ['Triceps', 'Upper chest', 'Core'],
    description: 'A standing vertical press for shoulder strength.',
    instructions: ['Hold the bar at collarbone height, grip just outside shoulders, elbows slightly forward.', 'Squeeze glutes and brace your core — ribs down.', 'Press the bar straight up, moving your head back then through once it passes your face.', 'Lock out overhead with the bar over mid-foot.', 'Lower under control back to your collarbone.'],
    commonMistakes: ['Over-arching the lower back', 'Pressing the bar out in front', 'Using leg drive on strict sets'],
  },
  {
    slug: 'push-up', name: 'Push-up', category: 'STRENGTH', difficulty: 'BEGINNER', equipment: [],
    primaryMuscles: ['Chest', 'Triceps'], secondaryMuscles: ['Shoulders', 'Core'],
    description: 'A bodyweight horizontal press.',
    instructions: ['Hands slightly wider than shoulders, body in a straight line from head to heels.', 'Brace your core and squeeze glutes — no sagging hips.', 'Lower your chest toward the floor, elbows about 45° from your body.', 'Pause just above the floor, then push the floor away until arms are straight.', 'Keep your neck neutral — look a little ahead of your hands.'],
    commonMistakes: ['Sagging hips', 'Flaring elbows straight out', 'Half reps'],
  },
  {
    slug: 'dumbbell-biceps-curl', name: 'Dumbbell Biceps Curl', category: 'STRENGTH', difficulty: 'BEGINNER', equipment: ['Dumbbells'],
    primaryMuscles: ['Biceps'], secondaryMuscles: ['Forearms'],
    description: 'An isolation movement for the front of the upper arm.',
    instructions: ['Stand tall, dumbbells at your sides, palms forward, elbows pinned to your ribs.', 'Curl the weights up by bending only at the elbows.', 'Squeeze your biceps at the top without letting shoulders roll forward.', 'Lower for a slow 3-count until arms are almost straight.'],
    commonMistakes: ['Swinging the torso', 'Elbows drifting forward', 'Dropping the weight fast'],
  },
  {
    slug: 'split-lunge', name: 'Split Lunge', category: 'STRENGTH', difficulty: 'BEGINNER', equipment: [],
    primaryMuscles: ['Quads', 'Glutes'], secondaryMuscles: ['Hamstrings', 'Core'],
    description: 'A single-leg-dominant squat pattern from a split stance.',
    instructions: ['Take a long stride forward and stay on the ball of your back foot.', 'Keep your torso tall and core tight.', 'Lower straight down until your back knee almost touches the floor.', 'Front knee stays over your ankle, front heel planted.', 'Push through the front heel to rise. Finish all reps, then switch legs.'],
    commonMistakes: ['Front knee collapsing inward', 'Leaning far forward', 'Stride too short'],
  },
  {
    slug: 'bent-over-barbell-row', name: 'Bent-over Barbell Row', category: 'STRENGTH', difficulty: 'INTERMEDIATE', equipment: ['Barbell'],
    primaryMuscles: ['Lats', 'Mid back'], secondaryMuscles: ['Biceps', 'Rear delts', 'Lower back'],
    description: 'A horizontal pull for back thickness.',
    instructions: ['Hinge forward with a flat back until your torso is about 30° from parallel, knees soft.', 'Let the bar hang at arm\'s length below your shoulders.', 'Pull the bar toward your lower ribs, driving elbows back.', 'Squeeze your shoulder blades at the top.', 'Lower slowly — don\'t let your torso rise.'],
    commonMistakes: ['Standing up as you pull', 'Rounded lower back', 'Yanking with momentum'],
  },
  {
    slug: 'pull-up', name: 'Pull-up', category: 'STRENGTH', difficulty: 'ADVANCED', equipment: ['Pull-up bar'],
    primaryMuscles: ['Lats'], secondaryMuscles: ['Biceps', 'Upper back', 'Core'],
    description: 'A bodyweight vertical pull.',
    instructions: ['Grab the bar slightly wider than shoulders, palms facing away, and hang with straight arms.', 'Pull your shoulder blades down, then drive elbows toward your hips.', 'Pull until your chin clears the bar — chest to the bar if you can.', 'Lower slowly all the way back to a dead hang.', 'Avoid kicking or swinging.'],
    commonMistakes: ['Kipping / swinging', 'Partial range of motion', 'Shrugging shoulders to the ears'],
  },
  {
    slug: 'forearm-plank', name: 'Forearm Plank', category: 'CORE', difficulty: 'BEGINNER', equipment: [],
    primaryMuscles: ['Core'], secondaryMuscles: ['Shoulders', 'Glutes'],
    description: 'An isometric core hold.',
    instructions: ['Place elbows under shoulders, forearms on the floor.', 'Walk feet back so your body is one straight line.', 'Squeeze glutes, brace abs as if bracing for a punch.', 'Keep hips level — no sagging or piking.', 'Hold for 20–60 seconds while breathing steadily.'],
    commonMistakes: ['Hips sagging', 'Hips too high', 'Holding your breath'],
  },
  {
    slug: 'crunch', name: 'Crunch', category: 'CORE', difficulty: 'BEGINNER', equipment: [],
    primaryMuscles: ['Abs'], secondaryMuscles: [],
    description: 'A short-range abdominal flexion.',
    instructions: ['Lie on your back, knees bent, feet flat.', 'Hands lightly behind your head — don\'t pull on your neck.', 'Exhale and curl your ribs toward your hips, lifting shoulder blades off the floor.', 'Pause briefly, then lower slowly.'],
    commonMistakes: ['Pulling on the neck', 'Using momentum', 'Lifting the lower back off the floor'],
  },
  {
    slug: 'standing-calf-raise', name: 'Standing Calf Raise', category: 'STRENGTH', difficulty: 'BEGINNER', equipment: [],
    primaryMuscles: ['Calves'], secondaryMuscles: [],
    description: 'Calf isolation.',
    instructions: ['Stand tall with the balls of your feet on the floor or a step.', 'Rise as high as you can onto your toes.', 'Pause and squeeze your calves for a second.', 'Lower slowly until your heels are below the step if possible.'],
    commonMistakes: ['Bouncing', 'Bending the knees', 'Short range of motion'],
  },
  {
    slug: 'standing-quad-stretch', name: 'Standing Quad Stretch', category: 'STRETCH', difficulty: 'BEGINNER', equipment: [],
    primaryMuscles: ['Quads'], secondaryMuscles: ['Hip flexors'],
    description: 'A standing stretch for the front of the thigh.',
    instructions: ['Stand tall — hold a wall or chair for balance if you need to.', 'Bend one knee and bring your heel up toward your glute.', 'Hold your ankle (or foot) with the hand on the same side.', 'Keep your knees close together and tuck your pelvis slightly — don\'t arch your lower back.', 'Gently draw the heel closer until you feel a stretch down the front of the thigh.', 'Hold 20–30 seconds, then switch legs.'],
    commonMistakes: ['Arching the lower back', 'Letting the knee drift far out to the side', 'Pulling hard or bouncing'],
  },
];
