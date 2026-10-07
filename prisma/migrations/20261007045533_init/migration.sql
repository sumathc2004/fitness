-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `name` ENUM('SUPER_ADMIN', 'TRAINER', 'CLIENT') NOT NULL,
    `description` VARCHAR(191) NULL,
    `permissions` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Role_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED', 'INVITED') NOT NULL DEFAULT 'ACTIVE',
    `emailVerifiedAt` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `failedLogins` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_roleId_idx`(`roleId`),
    INDEX `User_status_idx`(`status`),
    INDEX `User_lastName_firstName_idx`(`lastName`, `firstName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `familyId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `replacedBy` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `ip` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RefreshToken_tokenHash_key`(`tokenHash`),
    INDEX `RefreshToken_userId_idx`(`userId`),
    INDEX `RefreshToken_familyId_idx`(`familyId`),
    INDEX `RefreshToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordResetToken_tokenHash_key`(`tokenHash`),
    INDEX `PasswordResetToken_userId_idx`(`userId`),
    INDEX `PasswordResetToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Trainer` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `bio` TEXT NULL,
    `specialties` JSON NULL,
    `certifications` JSON NULL,
    `hiredAt` DATETIME(3) NULL,
    `maxClients` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Trainer_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Client` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'PAUSED', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `dateOfBirth` DATETIME(3) NULL,
    `emergencyContact` VARCHAR(191) NULL,
    `qrCode` VARCHAR(191) NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Client_userId_key`(`userId`),
    UNIQUE INDEX `Client_qrCode_key`(`qrCode`),
    INDEX `Client_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrainerClient` (
    `id` VARCHAR(191) NOT NULL,
    `trainerId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT true,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,

    INDEX `TrainerClient_clientId_idx`(`clientId`),
    UNIQUE INDEX `TrainerClient_trainerId_clientId_key`(`trainerId`, `clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BodyProfile` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `sex` ENUM('MALE', 'FEMALE', 'OTHER') NOT NULL,
    `heightCm` DOUBLE NOT NULL,
    `activityLevel` ENUM('SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE') NOT NULL DEFAULT 'MODERATE',
    `trainingExperience` ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED') NOT NULL DEFAULT 'BEGINNER',
    `goal` ENUM('FAT_LOSS', 'RECOMPOSITION', 'MUSCLE_BUILDING') NOT NULL DEFAULT 'RECOMPOSITION',
    `injuries` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BodyProfile_clientId_key`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BodyMeasurement` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `measuredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `weightKg` DOUBLE NULL,
    `waistCm` DOUBLE NULL,
    `neckCm` DOUBLE NULL,
    `hipCm` DOUBLE NULL,
    `chestCm` DOUBLE NULL,
    `shoulderCm` DOUBLE NULL,
    `armCm` DOUBLE NULL,
    `thighCm` DOUBLE NULL,
    `notes` TEXT NULL,
    `recordedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BodyMeasurement_clientId_measuredAt_idx`(`clientId`, `measuredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BodyCompositionAssessment` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `measurementId` VARCHAR(191) NULL,
    `assessedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `method` VARCHAR(191) NOT NULL DEFAULT 'US_NAVY',
    `inputs` JSON NOT NULL,
    `bmi` DOUBLE NULL,
    `bodyFatPct` DOUBLE NULL,
    `fatMassKg` DOUBLE NULL,
    `leanMassKg` DOUBLE NULL,
    `bmr` DOUBLE NULL,
    `maintenanceKcal` DOUBLE NULL,
    `isEstimate` BOOLEAN NOT NULL DEFAULT true,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BodyCompositionAssessment_clientId_assessedAt_idx`(`clientId`, `assessedAt`),
    INDEX `BodyCompositionAssessment_measurementId_idx`(`measurementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NutritionProfile` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `calorieAdjustPct` DOUBLE NULL,
    `proteinPerKg` DOUBLE NULL,
    `fatPct` DOUBLE NULL,
    `fiberPer1000Kcal` DOUBLE NULL,
    `waterMlPerKg` DOUBLE NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NutritionProfile_clientId_key`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NutritionTarget` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `trainerId` VARCHAR(191) NULL,
    `effectiveFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `calories` DOUBLE NOT NULL,
    `proteinG` DOUBLE NOT NULL,
    `carbsG` DOUBLE NOT NULL,
    `fatG` DOUBLE NOT NULL,
    `fiberG` DOUBLE NOT NULL,
    `waterMl` DOUBLE NULL,
    `source` ENUM('CALCULATED', 'TRAINER') NOT NULL DEFAULT 'CALCULATED',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `rationale` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `NutritionTarget_clientId_isActive_idx`(`clientId`, `isActive`),
    INDEX `NutritionTarget_trainerId_idx`(`trainerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NutritionRecommendation` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `recommendedGoal` ENUM('FAT_LOSS', 'RECOMPOSITION', 'MUSCLE_BUILDING') NOT NULL,
    `reasons` JSON NOT NULL,
    `inputs` JSON NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'TRAINER_REVIEW', 'DISMISSED') NOT NULL DEFAULT 'PENDING',
    `decidedById` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `NutritionRecommendation_clientId_createdAt_idx`(`clientId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FoodItem` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `cuisine` VARCHAR(191) NULL,
    `brand` VARCHAR(191) NULL,
    `isCustom` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FoodItem_name_idx`(`name`),
    INDEX `FoodItem_category_idx`(`category`),
    INDEX `FoodItem_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FoodServing` (
    `id` VARCHAR(191) NOT NULL,
    `foodItemId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `grams` DOUBLE NULL,
    `calories` DOUBLE NOT NULL,
    `proteinG` DOUBLE NOT NULL,
    `carbsG` DOUBLE NOT NULL,
    `fatG` DOUBLE NOT NULL,
    `fiberG` DOUBLE NOT NULL DEFAULT 0,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,

    INDEX `FoodServing_foodItemId_idx`(`foodItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DietPlan` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `trainerId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `targetId` VARCHAR(191) NULL,
    `isTemplate` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('DRAFT', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DietPlan_trainerId_idx`(`trainerId`),
    INDEX `DietPlan_clientId_status_idx`(`clientId`, `status`),
    INDEX `DietPlan_targetId_idx`(`targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DietMeal` (
    `id` VARCHAR(191) NOT NULL,
    `dietPlanId` VARCHAR(191) NOT NULL,
    `mealType` ENUM('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'PRE_WORKOUT', 'POST_WORKOUT', 'CUSTOM') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `timeOfDay` VARCHAR(191) NULL,
    `notes` TEXT NULL,

    INDEX `DietMeal_dietPlanId_order_idx`(`dietPlanId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DietMealItem` (
    `id` VARCHAR(191) NOT NULL,
    `dietMealId` VARCHAR(191) NOT NULL,
    `foodItemId` VARCHAR(191) NULL,
    `foodServingId` VARCHAR(191) NULL,
    `customName` VARCHAR(191) NULL,
    `quantity` DOUBLE NOT NULL DEFAULT 1,
    `calories` DOUBLE NOT NULL,
    `proteinG` DOUBLE NOT NULL,
    `carbsG` DOUBLE NOT NULL,
    `fatG` DOUBLE NOT NULL,
    `fiberG` DOUBLE NOT NULL DEFAULT 0,

    INDEX `DietMealItem_dietMealId_idx`(`dietMealId`),
    INDEX `DietMealItem_foodItemId_idx`(`foodItemId`),
    INDEX `DietMealItem_foodServingId_idx`(`foodServingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DietLog` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `dietMealId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `loggedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,

    INDEX `DietLog_clientId_date_idx`(`clientId`, `date`),
    UNIQUE INDEX `DietLog_clientId_dietMealId_date_key`(`clientId`, `dietMealId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MealLog` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `mealType` ENUM('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'PRE_WORKOUT', 'POST_WORKOUT', 'CUSTOM') NOT NULL,
    `dietMealId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'SKIPPED') NOT NULL DEFAULT 'COMPLETED',
    `notes` TEXT NULL,
    `loggedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MealLog_clientId_date_idx`(`clientId`, `date`),
    INDEX `MealLog_dietMealId_idx`(`dietMealId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MealLogItem` (
    `id` VARCHAR(191) NOT NULL,
    `mealLogId` VARCHAR(191) NOT NULL,
    `foodItemId` VARCHAR(191) NULL,
    `foodServingId` VARCHAR(191) NULL,
    `customName` VARCHAR(191) NULL,
    `quantity` DOUBLE NOT NULL DEFAULT 1,
    `calories` DOUBLE NOT NULL,
    `proteinG` DOUBLE NOT NULL,
    `carbsG` DOUBLE NOT NULL,
    `fatG` DOUBLE NOT NULL,
    `fiberG` DOUBLE NOT NULL DEFAULT 0,

    INDEX `MealLogItem_mealLogId_idx`(`mealLogId`),
    INDEX `MealLogItem_foodItemId_idx`(`foodItemId`),
    INDEX `MealLogItem_foodServingId_idx`(`foodServingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Exercise` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` ENUM('STRENGTH', 'CARDIO', 'MOBILITY', 'STRETCH', 'PLYOMETRIC', 'CORE') NOT NULL DEFAULT 'STRENGTH',
    `difficulty` ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED') NOT NULL DEFAULT 'BEGINNER',
    `equipment` JSON NULL,
    `primaryMuscles` JSON NOT NULL,
    `secondaryMuscles` JSON NULL,
    `instructions` JSON NOT NULL,
    `commonMistakes` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Exercise_slug_key`(`slug`),
    INDEX `Exercise_name_idx`(`name`),
    INDEX `Exercise_category_idx`(`category`),
    INDEX `Exercise_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Exercise3DAsset` (
    `id` VARCHAR(191) NOT NULL,
    `exerciseId` VARCHAR(191) NOT NULL,
    `glbUrl` VARCHAR(191) NOT NULL,
    `thumbnailUrl` VARCHAR(191) NULL,
    `animationClip` VARCHAR(191) NULL,
    `storageProvider` VARCHAR(191) NOT NULL DEFAULT 'local',
    `storageKey` VARCHAR(191) NULL,
    `fileSizeBytes` INTEGER NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `credit` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Exercise3DAsset_exerciseId_isActive_idx`(`exerciseId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Workout` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `trainerId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `isTemplate` BOOLEAN NOT NULL DEFAULT false,
    `scheduledDate` DATE NULL,
    `status` ENUM('DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED') NOT NULL DEFAULT 'DRAFT',
    `estimatedMin` INTEGER NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Workout_trainerId_idx`(`trainerId`),
    INDEX `Workout_clientId_scheduledDate_idx`(`clientId`, `scheduledDate`),
    INDEX `Workout_isTemplate_idx`(`isTemplate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkoutExercise` (
    `id` VARCHAR(191) NOT NULL,
    `workoutId` VARCHAR(191) NOT NULL,
    `exerciseId` VARCHAR(191) NULL,
    `customName` VARCHAR(191) NULL,
    `section` ENUM('WARMUP', 'MAIN', 'COOLDOWN', 'CARDIO') NOT NULL DEFAULT 'MAIN',
    `order` INTEGER NOT NULL DEFAULT 0,
    `sets` INTEGER NOT NULL DEFAULT 3,
    `reps` VARCHAR(191) NOT NULL DEFAULT '10',
    `weightKg` DOUBLE NULL,
    `restSec` INTEGER NOT NULL DEFAULT 60,
    `tempo` VARCHAR(191) NULL,
    `technique` ENUM('NORMAL', 'SUPERSET', 'DROPSET') NOT NULL DEFAULT 'NORMAL',
    `supersetGroup` INTEGER NULL,
    `notes` TEXT NULL,

    INDEX `WorkoutExercise_workoutId_order_idx`(`workoutId`, `order`),
    INDEX `WorkoutExercise_exerciseId_idx`(`exerciseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkoutSession` (
    `id` VARCHAR(191) NOT NULL,
    `workoutId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `status` ENUM('IN_PROGRESS', 'COMPLETED', 'ABANDONED') NOT NULL DEFAULT 'IN_PROGRESS',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `perceivedExertion` INTEGER NULL,
    `notes` TEXT NULL,

    INDEX `WorkoutSession_clientId_startedAt_idx`(`clientId`, `startedAt`),
    INDEX `WorkoutSession_workoutId_idx`(`workoutId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkoutSet` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `workoutExerciseId` VARCHAR(191) NOT NULL,
    `setNumber` INTEGER NOT NULL,
    `targetReps` INTEGER NULL,
    `reps` INTEGER NULL,
    `weightKg` DOUBLE NULL,
    `rpe` DOUBLE NULL,
    `skipped` BOOLEAN NOT NULL DEFAULT false,
    `restSecTaken` INTEGER NULL,
    `completedAt` DATETIME(3) NULL,

    INDEX `WorkoutSet_workoutExerciseId_idx`(`workoutExerciseId`),
    UNIQUE INDEX `WorkoutSet_sessionId_workoutExerciseId_setNumber_key`(`sessionId`, `workoutExerciseId`, `setNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProgressRecord` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `period` ENUM('WEEKLY', 'MONTHLY') NOT NULL,
    `periodStart` DATE NOT NULL,
    `periodEnd` DATE NOT NULL,
    `weightChangeKg` DOUBLE NULL,
    `bodyFatChangePct` DOUBLE NULL,
    `leanMassChangeKg` DOUBLE NULL,
    `waistChangeCm` DOUBLE NULL,
    `workoutCompliance` DOUBLE NULL,
    `dietCompliance` DOUBLE NULL,
    `trainerComment` TEXT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProgressRecord_clientId_periodStart_idx`(`clientId`, `periodStart`),
    UNIQUE INDEX `ProgressRecord_clientId_period_periodStart_key`(`clientId`, `period`, `periodStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProgressPhoto` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `takenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `angle` ENUM('FRONT', 'SIDE', 'BACK', 'OTHER') NOT NULL DEFAULT 'FRONT',
    `url` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(191) NULL,
    `weightKg` DOUBLE NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProgressPhoto_clientId_takenAt_idx`(`clientId`, `takenAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attendance` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `status` ENUM('PRESENT', 'ABSENT', 'LATE', 'LEAVE') NOT NULL DEFAULT 'PRESENT',
    `method` ENUM('MANUAL', 'QR', 'BIOMETRIC') NOT NULL DEFAULT 'MANUAL',
    `checkInAt` DATETIME(3) NULL,
    `checkOutAt` DATETIME(3) NULL,
    `recordedBy` VARCHAR(191) NULL,
    `deviceId` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Attendance_date_status_idx`(`date`, `status`),
    UNIQUE INDEX `Attendance_clientId_date_key`(`clientId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WaterLog` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `amountMl` INTEGER NOT NULL,
    `loggedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WaterLog_clientId_date_idx`(`clientId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SleepLog` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `hours` DOUBLE NOT NULL,
    `quality` INTEGER NULL,
    `bedtime` DATETIME(3) NULL,
    `wakeTime` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `loggedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SleepLog_clientId_date_key`(`clientId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HabitLog` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `habitKey` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `value` DOUBLE NULL,
    `unit` VARCHAR(191) NULL,
    `loggedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HabitLog_clientId_habitKey_idx`(`clientId`, `habitKey`),
    UNIQUE INDEX `HabitLog_clientId_date_habitKey_key`(`clientId`, `date`, `habitKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(191) NOT NULL,
    `conversationKey` VARCHAR(191) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `recipientId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Message_conversationKey_createdAt_idx`(`conversationKey`, `createdAt`),
    INDEX `Message_recipientId_readAt_idx`(`recipientId`, `readAt`),
    INDEX `Message_senderId_idx`(`senderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('WORKOUT_ASSIGNED', 'WORKOUT_REMINDER', 'DIET_ASSIGNED', 'MEAL_REMINDER', 'TRAINER_MESSAGE', 'PROGRESS_REVIEW', 'MISSED_WORKOUT', 'MEMBERSHIP_EXPIRY', 'PAYMENT_REMINDER', 'SYSTEM') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NULL,
    `data` JSON NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_readAt_createdAt_idx`(`userId`, `readAt`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Membership` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `durationDays` INTEGER NOT NULL,
    `features` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `membershipId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'EXPIRED', 'CANCELLED', 'PAUSED', 'PENDING') NOT NULL DEFAULT 'ACTIVE',
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `autoRenew` BOOLEAN NOT NULL DEFAULT false,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Subscription_clientId_status_idx`(`clientId`, `status`),
    INDEX `Subscription_membershipId_idx`(`membershipId`),
    INDEX `Subscription_endDate_status_idx`(`endDate`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NULL,
    `invoiceNo` VARCHAR(191) NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `status` ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `method` ENUM('CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'ONLINE', 'OTHER') NOT NULL DEFAULT 'CASH',
    `provider` VARCHAR(191) NULL,
    `providerRef` VARCHAR(191) NULL,
    `dueDate` DATE NULL,
    `paidAt` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Payment_invoiceNo_key`(`invoiceNo`),
    INDEX `Payment_clientId_createdAt_idx`(`clientId`, `createdAt`),
    INDEX `Payment_subscriptionId_idx`(`subscriptionId`),
    INDEX `Payment_status_paidAt_idx`(`status`, `paidAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivityLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `clientId` VARCHAR(191) NULL,
    `type` ENUM('WORKOUT_STARTED', 'EXERCISE_COMPLETED', 'EXERCISE_SKIPPED', 'WORKOUT_COMPLETED', 'MEAL_LOGGED', 'MEAL_SKIPPED', 'WATER_LOGGED', 'SLEEP_LOGGED', 'WEIGHT_UPDATED', 'CHECKED_IN', 'CHECKED_OUT', 'MESSAGE_SENT', 'PROGRESS_PHOTO_ADDED', 'ASSESSMENT_CREATED') NOT NULL,
    `entityType` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityLog_clientId_createdAt_idx`(`clientId`, `createdAt`),
    INDEX `ActivityLog_actorUserId_idx`(`actorUserId`),
    INDEX `ActivityLog_type_createdAt_idx`(`type`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `ip` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_action_createdAt_idx`(`action`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Trainer` ADD CONSTRAINT `Trainer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainerClient` ADD CONSTRAINT `TrainerClient_trainerId_fkey` FOREIGN KEY (`trainerId`) REFERENCES `Trainer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainerClient` ADD CONSTRAINT `TrainerClient_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BodyProfile` ADD CONSTRAINT `BodyProfile_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BodyMeasurement` ADD CONSTRAINT `BodyMeasurement_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BodyCompositionAssessment` ADD CONSTRAINT `BodyCompositionAssessment_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BodyCompositionAssessment` ADD CONSTRAINT `BodyCompositionAssessment_measurementId_fkey` FOREIGN KEY (`measurementId`) REFERENCES `BodyMeasurement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NutritionProfile` ADD CONSTRAINT `NutritionProfile_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NutritionTarget` ADD CONSTRAINT `NutritionTarget_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NutritionTarget` ADD CONSTRAINT `NutritionTarget_trainerId_fkey` FOREIGN KEY (`trainerId`) REFERENCES `Trainer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NutritionRecommendation` ADD CONSTRAINT `NutritionRecommendation_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FoodServing` ADD CONSTRAINT `FoodServing_foodItemId_fkey` FOREIGN KEY (`foodItemId`) REFERENCES `FoodItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DietPlan` ADD CONSTRAINT `DietPlan_trainerId_fkey` FOREIGN KEY (`trainerId`) REFERENCES `Trainer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DietPlan` ADD CONSTRAINT `DietPlan_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DietPlan` ADD CONSTRAINT `DietPlan_targetId_fkey` FOREIGN KEY (`targetId`) REFERENCES `NutritionTarget`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DietMeal` ADD CONSTRAINT `DietMeal_dietPlanId_fkey` FOREIGN KEY (`dietPlanId`) REFERENCES `DietPlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DietMealItem` ADD CONSTRAINT `DietMealItem_dietMealId_fkey` FOREIGN KEY (`dietMealId`) REFERENCES `DietMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DietMealItem` ADD CONSTRAINT `DietMealItem_foodItemId_fkey` FOREIGN KEY (`foodItemId`) REFERENCES `FoodItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DietMealItem` ADD CONSTRAINT `DietMealItem_foodServingId_fkey` FOREIGN KEY (`foodServingId`) REFERENCES `FoodServing`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DietLog` ADD CONSTRAINT `DietLog_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DietLog` ADD CONSTRAINT `DietLog_dietMealId_fkey` FOREIGN KEY (`dietMealId`) REFERENCES `DietMeal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MealLog` ADD CONSTRAINT `MealLog_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MealLog` ADD CONSTRAINT `MealLog_dietMealId_fkey` FOREIGN KEY (`dietMealId`) REFERENCES `DietMeal`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MealLogItem` ADD CONSTRAINT `MealLogItem_mealLogId_fkey` FOREIGN KEY (`mealLogId`) REFERENCES `MealLog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MealLogItem` ADD CONSTRAINT `MealLogItem_foodItemId_fkey` FOREIGN KEY (`foodItemId`) REFERENCES `FoodItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MealLogItem` ADD CONSTRAINT `MealLogItem_foodServingId_fkey` FOREIGN KEY (`foodServingId`) REFERENCES `FoodServing`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Exercise` ADD CONSTRAINT `Exercise_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `Trainer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Exercise3DAsset` ADD CONSTRAINT `Exercise3DAsset_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Workout` ADD CONSTRAINT `Workout_trainerId_fkey` FOREIGN KEY (`trainerId`) REFERENCES `Trainer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Workout` ADD CONSTRAINT `Workout_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkoutExercise` ADD CONSTRAINT `WorkoutExercise_workoutId_fkey` FOREIGN KEY (`workoutId`) REFERENCES `Workout`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkoutExercise` ADD CONSTRAINT `WorkoutExercise_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkoutSession` ADD CONSTRAINT `WorkoutSession_workoutId_fkey` FOREIGN KEY (`workoutId`) REFERENCES `Workout`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkoutSession` ADD CONSTRAINT `WorkoutSession_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkoutSet` ADD CONSTRAINT `WorkoutSet_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `WorkoutSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkoutSet` ADD CONSTRAINT `WorkoutSet_workoutExerciseId_fkey` FOREIGN KEY (`workoutExerciseId`) REFERENCES `WorkoutExercise`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgressRecord` ADD CONSTRAINT `ProgressRecord_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgressPhoto` ADD CONSTRAINT `ProgressPhoto_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WaterLog` ADD CONSTRAINT `WaterLog_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SleepLog` ADD CONSTRAINT `SleepLog_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HabitLog` ADD CONSTRAINT `HabitLog_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_membershipId_fkey` FOREIGN KEY (`membershipId`) REFERENCES `Membership`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog` ADD CONSTRAINT `ActivityLog_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog` ADD CONSTRAINT `ActivityLog_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
