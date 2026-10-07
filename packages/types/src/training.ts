import { z } from 'zod';

export const exerciseCategorySchema = z.enum(['STRENGTH', 'CARDIO', 'MOBILITY', 'STRETCH', 'PLYOMETRIC', 'CORE']);
export const exerciseDifficultySchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
const list = (max = 12) => z.array(z.string().trim().min(1).max(120)).max(max);

export const exerciseInputSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(80),
  description: z.string().trim().max(1000).optional(),
  category: exerciseCategorySchema.default('STRENGTH'),
  difficulty: exerciseDifficultySchema.default('BEGINNER'),
  equipment: list(10).default([]),
  primaryMuscles: list(8).min(1, 'Add at least one primary muscle'),
  secondaryMuscles: list(8).default([]),
  instructions: list(15).min(1, 'Add at least one instruction step'),
  commonMistakes: list(10).default([]),
});
export type ExerciseInput = z.infer<typeof exerciseInputSchema>;

export interface Exercise3DAssetDto {
  id: string; url: string; animationClip: string | null; credit: string | null; fileSizeBytes: number | null; version: number; createdAt: string;
}

export interface ExerciseDto {
  id: string; slug: string; name: string; description: string | null;
  category: z.infer<typeof exerciseCategorySchema>; difficulty: z.infer<typeof exerciseDifficultySchema>;
  equipment: string[]; primaryMuscles: string[]; secondaryMuscles: string[]; instructions: string[]; commonMistakes: string[];
  isActive: boolean; createdById: string | null; assets: Exercise3DAssetDto[];
}

// ───────────────────────── workouts
export const workoutSectionSchema = z.enum(['WARMUP', 'MAIN', 'COOLDOWN', 'CARDIO']);
export const techniqueSchema = z.enum(['NORMAL', 'SUPERSET', 'DROPSET']);
export type WorkoutSection = z.infer<typeof workoutSectionSchema>;
export type Technique = z.infer<typeof techniqueSchema>;

export const workoutExerciseInputSchema = z.object({
  exerciseId: z.string().optional(),
  customName: z.string().trim().max(80).optional(),
  section: workoutSectionSchema.default('MAIN'),
  sets: z.coerce.number().int().min(1).max(20).default(3),
  reps: z.string().trim().min(1).max(20).default('10'),
  weightKg: z.coerce.number().min(0).max(1000).nullable().optional(),
  restSec: z.coerce.number().int().min(0).max(900).default(60),
  tempo: z.string().trim().max(20).nullable().optional(),
  technique: techniqueSchema.default('NORMAL'),
  supersetGroup: z.coerce.number().int().min(1).max(20).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
}).refine((e) => e.exerciseId || e.customName, { message: 'Pick an exercise or enter a custom name', path: ['exerciseId'] });
export type WorkoutExerciseInput = z.infer<typeof workoutExerciseInputSchema>;

export const workoutInputSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(80),
  clientId: z.string().optional(),
  isTemplate: z.boolean().default(false),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  estimatedMin: z.coerce.number().int().min(5).max(300).optional(),
  notes: z.string().trim().max(1000).optional(),
  exercises: z.array(workoutExerciseInputSchema).min(1, 'Add at least one exercise').max(40),
});
export type WorkoutInput = z.infer<typeof workoutInputSchema>;

export const assignWorkoutSchema = z.object({
  clientIds: z.array(z.string()).min(1, 'Pick at least one client').max(100),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
});

export interface WorkoutExerciseDto {
  id: string; exerciseId: string | null; name: string; slug: string | null; section: WorkoutSection; order: number; sets: number; reps: string;
  weightKg: number | null; restSec: number; tempo: string | null; technique: Technique; supersetGroup: number | null; notes: string | null;
  primaryMuscles: string[]; hasAsset: boolean;
}
export interface WorkoutDto {
  id: string; name: string; clientId: string | null; clientName: string | null; trainerId: string; isTemplate: boolean;
  scheduledDate: string | null; status: 'DRAFT' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'; estimatedMin: number | null; notes: string | null;
  exercises: WorkoutExerciseDto[]; createdAt: string;
}
export interface WorkoutSummary {
  id: string; name: string; clientId: string | null; clientName: string | null; isTemplate: boolean; scheduledDate: string | null; status: WorkoutDto['status']; exerciseCount: number; estimatedMin: number | null;
}

export const setLogSchema = z.object({
  sessionId: z.string(), workoutExerciseId: z.string(), setNumber: z.coerce.number().int().min(1).max(30),
  reps: z.coerce.number().int().min(0).max(500).nullable().optional(),
  weightKg: z.coerce.number().min(0).max(1000).nullable().optional(),
  rpe: z.coerce.number().min(1).max(10).nullable().optional(),
  skipped: z.boolean().default(false),
  restSecTaken: z.coerce.number().int().min(0).max(1800).nullable().optional(),
});
export type SetLogInput = z.infer<typeof setLogSchema>;

export interface SessionSetDto { id: string; workoutExerciseId: string; setNumber: number; targetReps: number | null; reps: number | null; weightKg: number | null; rpe: number | null; skipped: boolean; completed: boolean }
export interface PreviousPerformance { workoutExerciseId: string; exerciseId: string | null; date: string; sets: Array<{ setNumber: number; reps: number | null; weightKg: number | null }> }
export interface SessionDto {
  id: string; workoutId: string; workoutName: string; status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'; startedAt: string; completedAt: string | null; perceivedExertion: number | null;
  exercises: WorkoutExerciseDto[]; sets: SessionSetDto[]; previous: PreviousPerformance[];
}
export interface SessionSummary { id: string; workoutName: string; startedAt: string; completedAt: string | null; status: string; setsDone: number; volumeKg: number; clientName?: string }
