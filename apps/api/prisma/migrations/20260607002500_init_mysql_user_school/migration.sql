-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NOT NULL,
    `firstSeen` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeen` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `taskCount` INTEGER NOT NULL DEFAULT 0,
    `province` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `lastSchool` VARCHAR(191) NULL,
    `ipFirst` VARCHAR(191) NULL,
    `ipLast` VARCHAR(191) NULL,
    `wechatOpenid` VARCHAR(191) NULL,
    `wechatUnionid` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `emailVerifiedAt` DATETIME(3) NULL,
    `isBlocked` BOOLEAN NOT NULL DEFAULT false,
    `notes` VARCHAR(191) NULL,

    UNIQUE INDEX `User_deviceId_key`(`deviceId`),
    UNIQUE INDEX `User_wechatOpenid_key`(`wechatOpenid`),
    UNIQUE INDEX `User_wechatUnionid_key`(`wechatUnionid`),
    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_firstSeen_idx`(`firstSeen`),
    INDEX `User_province_idx`(`province`),
    INDEX `User_lastSchool_idx`(`lastSchool`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Task` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `platform` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'awaiting_payment',
    `schoolName` VARCHAR(191) NULL,
    `province` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `credsCipher` VARCHAR(191) NOT NULL,
    `credsIv` VARCHAR(191) NOT NULL,
    `credsTag` VARCHAR(191) NOT NULL,
    `options` VARCHAR(191) NULL,
    `notifyChannel` VARCHAR(191) NULL,
    `notifyTarget` VARCHAR(191) NULL,
    `amount` INTEGER NOT NULL DEFAULT 0,
    `paidAt` DATETIME(3) NULL,
    `payTradeNo` VARCHAR(191) NULL,
    `payChannel` VARCHAR(191) NULL,
    `result` VARCHAR(191) NULL,
    `errorMsg` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `progressJson` VARCHAR(191) NULL,

    INDEX `Task_status_paidAt_idx`(`status`, `paidAt`),
    INDEX `Task_paidAt_status_idx`(`paidAt`, `status`),
    INDEX `Task_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `Task_platform_createdAt_idx`(`platform`, `createdAt`),
    INDEX `Task_schoolName_idx`(`schoolName`),
    INDEX `Task_province_idx`(`province`),
    INDEX `Task_createdAt_idx`(`createdAt`),
    INDEX `Task_amount_idx`(`amount`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskId` VARCHAR(191) NOT NULL,
    `event` VARCHAR(191) NOT NULL,
    `payload` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TaskEvent_taskId_id_idx`(`taskId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Admin` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'admin',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastLoginAt` DATETIME(3) NULL,

    UNIQUE INDEX `Admin_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Question` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `questionText` VARCHAR(191) NOT NULL,
    `options` VARCHAR(191) NULL,
    `answer` VARCHAR(191) NOT NULL,
    `questionType` VARCHAR(191) NOT NULL DEFAULT 'single',
    `hitCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Question_platform_category_idx`(`platform`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskEvent` ADD CONSTRAINT `TaskEvent_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

