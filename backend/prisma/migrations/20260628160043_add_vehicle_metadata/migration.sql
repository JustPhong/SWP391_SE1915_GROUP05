/*
  Warnings:

  - You are about to alter the column `status` on the `Booking` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(30)`.
  - You are about to alter the column `floorCode` on the `Floor` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(20)`.
  - You are about to alter the column `name` on the `Floor` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(60)`.
  - You are about to alter the column `vehicleType` on the `Floor` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(30)`.
  - You are about to alter the column `customerType` on the `Floor` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(30)`.
  - You are about to alter the column `planName` on the `MonthlyPackage` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(60)`.
  - You are about to alter the column `status` on the `MonthlyPackage` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(30)`.
  - You are about to alter the column `code` on the `ParkingSlot` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(20)`.
  - You are about to alter the column `type` on the `ParkingSlot` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(30)`.
  - You are about to alter the column `status` on the `ParkingSlot` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(30)`.
  - You are about to alter the column `method` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(30)`.
  - You are about to alter the column `type` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(30)`.
  - You are about to alter the column `key` on the `Permission` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(30)`.
  - You are about to alter the column `label` on the `Permission` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(100)`.
  - You are about to alter the column `category` on the `Permission` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(50)`.
  - You are about to drop the column `role` on the `RolePermission` table. All the data in the column will be lost.
  - You are about to alter the column `permissionKey` on the `RolePermission` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(30)`.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to alter the column `fullName` on the `User` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(100)`.
  - You are about to alter the column `email` on the `User` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(150)`.
  - You are about to alter the column `phoneNumber` on the `User` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(20)`.
  - You are about to alter the column `passwordHash` on the `User` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(255)`.
  - You are about to alter the column `plateNumber` on the `Vehicle` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(15)`.
  - You are about to alter the column `type` on the `Vehicle` table. The data in that column could be lost. The data in that column will be cast from `NVarChar(1000)` to `NVarChar(30)`.
  - A unique constraint covering the columns `[roleId,permissionKey]` on the table `RolePermission` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `roleId` to the `RolePermission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roleId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
BEGIN TRY

BEGIN TRAN;

-- DropIndex
ALTER TABLE [dbo].[Floor] DROP CONSTRAINT [Floor_floorCode_key];

-- DropIndex
ALTER TABLE [dbo].[ParkingSlot] DROP CONSTRAINT [ParkingSlot_code_key];

-- DropIndex
ALTER TABLE [dbo].[Permission] DROP CONSTRAINT [Permission_key_key];

-- DropIndex
ALTER TABLE [dbo].[RolePermission] DROP CONSTRAINT [RolePermission_role_permissionKey_key];

-- DropIndex
ALTER TABLE [dbo].[User] DROP CONSTRAINT [User_email_key];

-- DropIndex
ALTER TABLE [dbo].[Vehicle] DROP CONSTRAINT [Vehicle_plateNumber_key];

-- AlterTable
ALTER TABLE [dbo].[Booking] ALTER COLUMN [status] NVARCHAR(30) NOT NULL;
ALTER TABLE [dbo].[Booking] ADD [depositAmount] DECIMAL(10,2) NOT NULL CONSTRAINT [Booking_depositAmount_df] DEFAULT 0,
[depositStatus] NVARCHAR(30) NOT NULL CONSTRAINT [Booking_depositStatus_df] DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE [dbo].[CheckInRecord] ADD [checkedInById] NVARCHAR(1000),
[checkedOutById] NVARCHAR(1000),
[isLostTicket] BIT NOT NULL CONSTRAINT [CheckInRecord_isLostTicket_df] DEFAULT 0,
[status] NVARCHAR(30) NOT NULL CONSTRAINT [CheckInRecord_status_df] DEFAULT 'PARKING';

-- AlterTable
ALTER TABLE [dbo].[Floor] ALTER COLUMN [floorCode] NVARCHAR(20) NOT NULL;
ALTER TABLE [dbo].[Floor] ALTER COLUMN [name] NVARCHAR(60) NOT NULL;
ALTER TABLE [dbo].[Floor] ALTER COLUMN [vehicleType] NVARCHAR(30) NOT NULL;
ALTER TABLE [dbo].[Floor] ALTER COLUMN [customerType] NVARCHAR(30) NOT NULL;

-- AlterTable
ALTER TABLE [dbo].[MonthlyPackage] ALTER COLUMN [planName] NVARCHAR(60) NULL;
ALTER TABLE [dbo].[MonthlyPackage] ALTER COLUMN [status] NVARCHAR(30) NOT NULL;

-- AlterTable
ALTER TABLE [dbo].[ParkingSlot] ALTER COLUMN [code] NVARCHAR(20) NOT NULL;
ALTER TABLE [dbo].[ParkingSlot] ALTER COLUMN [type] NVARCHAR(30) NOT NULL;
ALTER TABLE [dbo].[ParkingSlot] ALTER COLUMN [status] NVARCHAR(30) NOT NULL;

-- AlterTable
ALTER TABLE [dbo].[Payment] ALTER COLUMN [method] NVARCHAR(30) NOT NULL;
ALTER TABLE [dbo].[Payment] ALTER COLUMN [type] NVARCHAR(30) NOT NULL;
ALTER TABLE [dbo].[Payment] ADD [collectedById] NVARCHAR(1000),
[status] NVARCHAR(30) NOT NULL CONSTRAINT [Payment_status_df] DEFAULT 'SUCCESS',
[transactionCode] NVARCHAR(50);

-- AlterTable
ALTER TABLE [dbo].[Permission] ALTER COLUMN [key] NVARCHAR(30) NOT NULL;
ALTER TABLE [dbo].[Permission] ALTER COLUMN [label] NVARCHAR(100) NOT NULL;
ALTER TABLE [dbo].[Permission] ALTER COLUMN [category] NVARCHAR(50) NOT NULL;
ALTER TABLE [dbo].[Permission] ADD [updatedAt] DATETIME2 NOT NULL CONSTRAINT [Permission_updatedAt_df] DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE [dbo].[RolePermission] ALTER COLUMN [permissionKey] NVARCHAR(30) NOT NULL;
ALTER TABLE [dbo].[RolePermission] DROP COLUMN [role];
ALTER TABLE [dbo].[RolePermission] ADD [roleId] INT NOT NULL,
[updatedAt] DATETIME2 NOT NULL CONSTRAINT [RolePermission_updatedAt_df] DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE [dbo].[User] ALTER COLUMN [fullName] NVARCHAR(100) NOT NULL;
ALTER TABLE [dbo].[User] ALTER COLUMN [email] NVARCHAR(150) NOT NULL;
ALTER TABLE [dbo].[User] ALTER COLUMN [phoneNumber] NVARCHAR(20) NULL;
ALTER TABLE [dbo].[User] ALTER COLUMN [passwordHash] NVARCHAR(255) NOT NULL;
DECLARE @userRoleDf sysname;
SELECT @userRoleDf = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c ON dc.parent_column_id = c.column_id AND dc.parent_object_id = c.object_id
JOIN sys.tables t ON c.object_id = t.object_id
WHERE t.name = 'User' AND c.name = 'role';
IF @userRoleDf IS NOT NULL
    EXEC('ALTER TABLE [dbo].[User] DROP CONSTRAINT [' + @userRoleDf + ']');
ALTER TABLE [dbo].[User] DROP COLUMN [role];
ALTER TABLE [dbo].[User] ADD [roleId] INT NOT NULL;

-- AlterTable
ALTER TABLE [dbo].[Vehicle] ALTER COLUMN [plateNumber] NVARCHAR(15) NOT NULL;
ALTER TABLE [dbo].[Vehicle] ALTER COLUMN [type] NVARCHAR(30) NOT NULL;
ALTER TABLE [dbo].[Vehicle] ADD [brand] NVARCHAR(60),
[color] NVARCHAR(30),
[model] NVARCHAR(60),
[year] INT;

-- CreateTable
CREATE TABLE [dbo].[Role] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(30) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Role_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL CONSTRAINT [Role_updatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Role_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Role_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[FeeRule] (
    [id] INT NOT NULL IDENTITY(1,1),
    [vehicleType] NVARCHAR(30) NOT NULL,
    [ruleType] NVARCHAR(30) NOT NULL,
    [label] NVARCHAR(80) NOT NULL,
    [startHour] INT NOT NULL,
    [endHour] INT NOT NULL,
    [blockMinutes] INT,
    [amount] DECIMAL(10,2) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [FeeRule_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [FeeRule_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [FeeRule_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AuditLog] (
    [id] NVARCHAR(1000) NOT NULL,
    [actorId] NVARCHAR(36),
    [actorName] NVARCHAR(150),
    [actorRole] NVARCHAR(30),
    [action] NVARCHAR(60) NOT NULL,
    [targetType] NVARCHAR(50),
    [targetId] NVARCHAR(36),
    [description] NVARCHAR(500) NOT NULL,
    [metadata] NVARCHAR(max),
    [ipAddress] NVARCHAR(45),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuditLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AuditLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email]);

-- CreateIndex
ALTER TABLE [dbo].[Vehicle] ADD CONSTRAINT [Vehicle_plateNumber_key] UNIQUE NONCLUSTERED ([plateNumber]);

-- CreateIndex
ALTER TABLE [dbo].[Floor] ADD CONSTRAINT [Floor_floorCode_key] UNIQUE NONCLUSTERED ([floorCode]);

-- CreateIndex
ALTER TABLE [dbo].[ParkingSlot] ADD CONSTRAINT [ParkingSlot_code_key] UNIQUE NONCLUSTERED ([code]);

-- CreateIndex
ALTER TABLE [dbo].[Permission] ADD CONSTRAINT [Permission_key_key] UNIQUE NONCLUSTERED ([key]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_actorId_idx] ON [dbo].[AuditLog]([actorId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_action_idx] ON [dbo].[AuditLog]([action]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_createdAt_idx] ON [dbo].[AuditLog]([createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Booking_status_expectedArrival_idx] ON [dbo].[Booking]([status], [expectedArrival]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CheckInRecord_status_idx] ON [dbo].[CheckInRecord]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CheckInRecord_vehicleId_idx] ON [dbo].[CheckInRecord]([vehicleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CheckInRecord_checkInTime_idx] ON [dbo].[CheckInRecord]([checkInTime]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MonthlyPackage_userId_idx] ON [dbo].[MonthlyPackage]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MonthlyPackage_status_expiryDate_idx] ON [dbo].[MonthlyPackage]([status], [expiryDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ParkingSlot_floorId_idx] ON [dbo].[ParkingSlot]([floorId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ParkingSlot_status_idx] ON [dbo].[ParkingSlot]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ParkingSlot_assignedVehicleId_idx] ON [dbo].[ParkingSlot]([assignedVehicleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Payment_paidAt_idx] ON [dbo].[Payment]([paidAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Payment_checkInRecordId_idx] ON [dbo].[Payment]([checkInRecordId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Payment_monthlyPackageId_idx] ON [dbo].[Payment]([monthlyPackageId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RolePermission_roleId_idx] ON [dbo].[RolePermission]([roleId]);

-- CreateIndex
ALTER TABLE [dbo].[RolePermission] ADD CONSTRAINT [RolePermission_roleId_permissionKey_key] UNIQUE NONCLUSTERED ([roleId], [permissionKey]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_roleId_idx] ON [dbo].[User]([roleId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Vehicle_ownerId_idx] ON [dbo].[Vehicle]([ownerId]);

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CheckInRecord] ADD CONSTRAINT [CheckInRecord_checkedInById_fkey] FOREIGN KEY ([checkedInById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CheckInRecord] ADD CONSTRAINT [CheckInRecord_checkedOutById_fkey] FOREIGN KEY ([checkedOutById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_collectedById_fkey] FOREIGN KEY ([collectedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RolePermission] ADD CONSTRAINT [RolePermission_permissionKey_fkey] FOREIGN KEY ([permissionKey]) REFERENCES [dbo].[Permission]([key]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[RolePermission] ADD CONSTRAINT [RolePermission_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
