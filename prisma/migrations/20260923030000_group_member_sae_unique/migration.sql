-- Un étudiant ne peut appartenir qu'à un seul groupe par SAÉ (contrainte en base, anti-concurrence).
ALTER TABLE `GroupMember` ADD COLUMN `saeId` VARCHAR(191) NULL;

UPDATE `GroupMember` gm JOIN `Group` g ON g.`id` = gm.`groupId` SET gm.`saeId` = g.`saeId`;

ALTER TABLE `GroupMember` MODIFY `saeId` VARCHAR(191) NOT NULL;

CREATE UNIQUE INDEX `GroupMember_saeId_userId_key` ON `GroupMember`(`saeId`, `userId`);
