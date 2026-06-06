BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(1000) NOT NULL,
    [fullName] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [phoneNumber] NVARCHAR(1000),
    [passwordHash] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL CONSTRAINT [User_role_df] DEFAULT 'DRIVER',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[Vehicle] (
    [id] NVARCHAR(1000) NOT NULL,
    [plateNumber] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [isMonthly] BIT NOT NULL CONSTRAINT [Vehicle_isMonthly_df] DEFAULT 0,
    [ownerId] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Vehicle_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Vehicle_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Vehicle_plateNumber_key] UNIQUE NONCLUSTERED ([plateNumber])
);

-- CreateTable
CREATE TABLE [dbo].[Floor] (
    [id] INT NOT NULL IDENTITY(1,1),
    [floorCode] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [vehicleType] NVARCHAR(1000) NOT NULL,
    [customerType] NVARCHAR(1000) NOT NULL,
    [capacity] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Floor_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Floor_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Floor_floorCode_key] UNIQUE NONCLUSTERED ([floorCode])
);

-- CreateTable
CREATE TABLE [dbo].[ParkingSlot] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [ParkingSlot_status_df] DEFAULT 'AVAILABLE',
    [isFixed] BIT NOT NULL CONSTRAINT [ParkingSlot_isFixed_df] DEFAULT 0,
    [assignedVehicleId] NVARCHAR(1000),
    [floorId] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ParkingSlot_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ParkingSlot_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ParkingSlot_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[MonthlyPackage] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [vehicleId] NVARCHAR(1000) NOT NULL,
    [slotId] NVARCHAR(1000),
    [planName] NVARCHAR(1000),
    [startDate] DATETIME2 NOT NULL,
    [expiryDate] DATETIME2 NOT NULL,
    [price] DECIMAL(10,2) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [MonthlyPackage_status_df] DEFAULT 'ACTIVE',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [MonthlyPackage_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [MonthlyPackage_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MonthlyPackage_vehicleId_key] UNIQUE NONCLUSTERED ([vehicleId])
);

-- CreateTable
CREATE TABLE [dbo].[Booking] (
    [id] NVARCHAR(1000) NOT NULL,
    [vehicleId] NVARCHAR(1000) NOT NULL,
    [slotId] NVARCHAR(1000) NOT NULL,
    [bookingTime] DATETIME2 NOT NULL CONSTRAINT [Booking_bookingTime_df] DEFAULT CURRENT_TIMESTAMP,
    [expectedArrival] DATETIME2 NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Booking_status_df] DEFAULT 'ACTIVE',
    [createdById] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Booking_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Booking_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[CheckInRecord] (
    [id] NVARCHAR(1000) NOT NULL,
    [vehicleId] NVARCHAR(1000) NOT NULL,
    [slotId] NVARCHAR(1000) NOT NULL,
    [checkInTime] DATETIME2 NOT NULL CONSTRAINT [CheckInRecord_checkInTime_df] DEFAULT CURRENT_TIMESTAMP,
    [checkOutTime] DATETIME2,
    [isMonthly] BIT NOT NULL CONSTRAINT [CheckInRecord_isMonthly_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CheckInRecord_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CheckInRecord_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Payment] (
    [id] NVARCHAR(1000) NOT NULL,
    [checkInRecordId] NVARCHAR(1000),
    [monthlyPackageId] NVARCHAR(1000),
    [amount] DECIMAL(10,2) NOT NULL,
    [method] NVARCHAR(1000) NOT NULL,
    [paidAt] DATETIME2 NOT NULL CONSTRAINT [Payment_paidAt_df] DEFAULT CURRENT_TIMESTAMP,
    [type] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Payment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Payment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[Vehicle] ADD CONSTRAINT [Vehicle_ownerId_fkey] FOREIGN KEY ([ownerId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ParkingSlot] ADD CONSTRAINT [ParkingSlot_assignedVehicleId_fkey] FOREIGN KEY ([assignedVehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ParkingSlot] ADD CONSTRAINT [ParkingSlot_floorId_fkey] FOREIGN KEY ([floorId]) REFERENCES [dbo].[Floor]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MonthlyPackage] ADD CONSTRAINT [MonthlyPackage_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MonthlyPackage] ADD CONSTRAINT [MonthlyPackage_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MonthlyPackage] ADD CONSTRAINT [MonthlyPackage_slotId_fkey] FOREIGN KEY ([slotId]) REFERENCES [dbo].[ParkingSlot]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Booking] ADD CONSTRAINT [Booking_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Booking] ADD CONSTRAINT [Booking_slotId_fkey] FOREIGN KEY ([slotId]) REFERENCES [dbo].[ParkingSlot]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Booking] ADD CONSTRAINT [Booking_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CheckInRecord] ADD CONSTRAINT [CheckInRecord_vehicleId_fkey] FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CheckInRecord] ADD CONSTRAINT [CheckInRecord_slotId_fkey] FOREIGN KEY ([slotId]) REFERENCES [dbo].[ParkingSlot]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_checkInRecordId_fkey] FOREIGN KEY ([checkInRecordId]) REFERENCES [dbo].[CheckInRecord]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_monthlyPackageId_fkey] FOREIGN KEY ([monthlyPackageId]) REFERENCES [dbo].[MonthlyPackage]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
