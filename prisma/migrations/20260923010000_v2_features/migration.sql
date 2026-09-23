-- AlterTable
ALTER TABLE `Course` ADD COLUMN `shareToken` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Criterion` ADD COLUMN `learningId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `DepositLink` ADD COLUMN `checkHttp` INTEGER NULL,
    ADD COLUMN `checkNote` VARCHAR(191) NULL,
    ADD COLUMN `checkStatus` ENUM('OK', 'PRIVATE', 'BROKEN', 'UNREACHABLE') NULL,
    ADD COLUMN `checkedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Group` ADD COLUMN `showcaseCategory` VARCHAR(191) NULL,
    ADD COLUMN `showcaseImageUrl` VARCHAR(2048) NULL,
    ADD COLUMN `showcaseStatus` ENUM('NONE', 'PENDING', 'PUBLISHED') NOT NULL DEFAULT 'NONE',
    ADD COLUMN `showcaseSummary` TEXT NULL,
    ADD COLUMN `showcaseTitle` VARCHAR(191) NULL,
    ADD COLUMN `showcaseUrl` VARCHAR(2048) NULL;

-- AlterTable
ALTER TABLE `Milestone` ADD COLUMN `peerReviewEnabled` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Sae` ADD COLUMN `cohortId` VARCHAR(191) NULL,
    ADD COLUMN `sourceSaeId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `SelfAssessment` ADD COLUMN `feedbackById` VARCHAR(191) NULL,
    ADD COLUMN `feedbackPublishedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `SelfAssessmentItem` ADD COLUMN `teacherComment` TEXT NULL,
    ADD COLUMN `teacherLevel` INTEGER NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `calendarToken` VARCHAR(191) NULL,
    ADD COLUMN `portfolioToken` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `PageRevision` (
    `id` VARCHAR(191) NOT NULL,
    `pageId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` JSON NULL,
    `markdown` LONGTEXT NULL,
    `authorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PageRevision_pageId_createdAt_idx`(`pageId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PageQuestion` (
    `id` VARCHAR(191) NOT NULL,
    `pageId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `anonymous` BOOLEAN NOT NULL DEFAULT false,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `inFaq` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PageQuestion_pageId_createdAt_idx`(`pageId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PageAnswer` (
    `id` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PageAnswer_questionId_createdAt_idx`(`questionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Competence` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `levelLabels` JSON NULL,

    UNIQUE INDEX `Competence_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EssentialComponent` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `label` TEXT NOT NULL,
    `competenceId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `EssentialComponent_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CriticalLearning` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `label` TEXT NOT NULL,
    `level` INTEGER NOT NULL,
    `competenceId` VARCHAR(191) NOT NULL,
    `parcours` VARCHAR(191) NULL,

    UNIQUE INDEX `CriticalLearning_code_key`(`code`),
    INDEX `CriticalLearning_competenceId_level_idx`(`competenceId`, `level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PortfolioEvidence` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `learningId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `url` VARCHAR(2048) NULL,
    `reflection` TEXT NULL,
    `level` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PortfolioEvidence_userId_learningId_idx`(`userId`, `learningId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cohort` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `parcours` VARCHAR(191) NULL,
    `academicYear` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Cohort_name_academicYear_key`(`name`, `academicYear`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CohortMember` (
    `cohortId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,

    INDEX `CohortMember_userId_idx`(`userId`),
    PRIMARY KEY (`cohortId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Announcement` (
    `id` VARCHAR(191) NOT NULL,
    `scope` ENUM('GLOBAL', 'COHORT', 'COURSE', 'SAE') NOT NULL,
    `cohortId` VARCHAR(191) NULL,
    `courseId` VARCHAR(191) NULL,
    `saeId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `authorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Announcement_scope_createdAt_idx`(`scope`, `createdAt`),
    INDEX `Announcement_courseId_idx`(`courseId`),
    INDEX `Announcement_saeId_idx`(`saeId`),
    INDEX `Announcement_cohortId_idx`(`cohortId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NULL,
    `link` VARCHAR(191) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_readAt_createdAt_idx`(`userId`, `readAt`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Favorite` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` ENUM('COURSE', 'PAGE', 'SAE') NOT NULL,
    `targetId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Favorite_userId_kind_targetId_key`(`userId`, `kind`, `targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommentSnippet` (
    `id` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `tag` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CommentSnippet_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PeerReview` (
    `id` VARCHAR(191) NOT NULL,
    `milestoneId` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `reviewerId` VARCHAR(191) NOT NULL,
    `revieweeId` VARCHAR(191) NOT NULL,
    `contribution` INTEGER NOT NULL,
    `comment` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PeerReview_groupId_idx`(`groupId`),
    UNIQUE INDEX `PeerReview_milestoneId_reviewerId_revieweeId_key`(`milestoneId`, `reviewerId`, `revieweeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DefenseSlot` (
    `id` VARCHAR(191) NOT NULL,
    `saeId` VARCHAR(191) NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `durationMin` INTEGER NOT NULL DEFAULT 20,
    `location` VARCHAR(191) NULL,
    `jury` VARCHAR(191) NULL,
    `groupId` VARCHAR(191) NULL,
    `bookedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `DefenseSlot_groupId_key`(`groupId`),
    INDEX `DefenseSlot_saeId_startsAt_idx`(`saeId`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Course_shareToken_key` ON `Course`(`shareToken`);

-- CreateIndex
CREATE FULLTEXT INDEX `Course_title_summary_idx` ON `Course`(`title`, `summary`);

-- CreateIndex
CREATE INDEX `Criterion_learningId_idx` ON `Criterion`(`learningId`);

-- CreateIndex
CREATE FULLTEXT INDEX `Page_title_markdown_idx` ON `Page`(`title`, `markdown`);

-- CreateIndex
CREATE FULLTEXT INDEX `Sae_title_markdown_idx` ON `Sae`(`title`, `markdown`);

-- CreateIndex
CREATE UNIQUE INDEX `user_calendarToken_key` ON `user`(`calendarToken`);

-- CreateIndex
CREATE UNIQUE INDEX `user_portfolioToken_key` ON `user`(`portfolioToken`);

-- AddForeignKey
ALTER TABLE `PageRevision` ADD CONSTRAINT `PageRevision_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `Page`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PageRevision` ADD CONSTRAINT `PageRevision_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PageQuestion` ADD CONSTRAINT `PageQuestion_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `Page`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PageQuestion` ADD CONSTRAINT `PageQuestion_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PageAnswer` ADD CONSTRAINT `PageAnswer_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `PageQuestion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PageAnswer` ADD CONSTRAINT `PageAnswer_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sae` ADD CONSTRAINT `Sae_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Criterion` ADD CONSTRAINT `Criterion_learningId_fkey` FOREIGN KEY (`learningId`) REFERENCES `CriticalLearning`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SelfAssessment` ADD CONSTRAINT `SelfAssessment_feedbackById_fkey` FOREIGN KEY (`feedbackById`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EssentialComponent` ADD CONSTRAINT `EssentialComponent_competenceId_fkey` FOREIGN KEY (`competenceId`) REFERENCES `Competence`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CriticalLearning` ADD CONSTRAINT `CriticalLearning_competenceId_fkey` FOREIGN KEY (`competenceId`) REFERENCES `Competence`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PortfolioEvidence` ADD CONSTRAINT `PortfolioEvidence_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PortfolioEvidence` ADD CONSTRAINT `PortfolioEvidence_learningId_fkey` FOREIGN KEY (`learningId`) REFERENCES `CriticalLearning`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CohortMember` ADD CONSTRAINT `CohortMember_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CohortMember` ADD CONSTRAINT `CohortMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_saeId_fkey` FOREIGN KEY (`saeId`) REFERENCES `Sae`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Favorite` ADD CONSTRAINT `Favorite_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommentSnippet` ADD CONSTRAINT `CommentSnippet_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PeerReview` ADD CONSTRAINT `PeerReview_milestoneId_fkey` FOREIGN KEY (`milestoneId`) REFERENCES `Milestone`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PeerReview` ADD CONSTRAINT `PeerReview_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PeerReview` ADD CONSTRAINT `PeerReview_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PeerReview` ADD CONSTRAINT `PeerReview_revieweeId_fkey` FOREIGN KEY (`revieweeId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DefenseSlot` ADD CONSTRAINT `DefenseSlot_saeId_fkey` FOREIGN KEY (`saeId`) REFERENCES `Sae`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DefenseSlot` ADD CONSTRAINT `DefenseSlot_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

