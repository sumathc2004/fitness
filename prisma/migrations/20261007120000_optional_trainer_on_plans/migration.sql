-- DropForeignKey
ALTER TABLE `DietPlan` DROP FOREIGN KEY `DietPlan_trainerId_fkey`;

-- DropForeignKey
ALTER TABLE `Workout` DROP FOREIGN KEY `Workout_trainerId_fkey`;

-- AlterTable
ALTER TABLE `DietPlan` ADD COLUMN `createdById` VARCHAR(191) NULL,
    MODIFY `trainerId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Workout` ADD COLUMN `createdById` VARCHAR(191) NULL,
    MODIFY `trainerId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `DietPlan` ADD CONSTRAINT `DietPlan_trainerId_fkey` FOREIGN KEY (`trainerId`) REFERENCES `Trainer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Workout` ADD CONSTRAINT `Workout_trainerId_fkey` FOREIGN KEY (`trainerId`) REFERENCES `Trainer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
