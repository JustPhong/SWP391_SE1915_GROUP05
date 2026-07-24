BEGIN TRY

BEGIN TRAN;

-- No-op: columns already added in 20260703070249_add_vehicle_owner_contact_fields

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH