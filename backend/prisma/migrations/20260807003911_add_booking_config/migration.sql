CREATE TABLE [dbo].[BookingConfig] (
    [id] INT NOT NULL
        CONSTRAINT [BookingConfig_id_df] DEFAULT (1),

    [depositAmount] DECIMAL(10, 2) NOT NULL,

    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [BookingConfig_pkey]
        PRIMARY KEY CLUSTERED ([id]),

    CONSTRAINT [BookingConfig_singleton_ck]
        CHECK ([id] = (1))
);

INSERT INTO [dbo].[BookingConfig]
    ([id], [depositAmount], [updatedAt])
VALUES
    (1, CAST(15000 AS DECIMAL(10, 2)), SYSDATETIME());