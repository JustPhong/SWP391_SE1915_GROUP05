import { body } from 'express-validator';

export const submitCheckinSchema = [
  body('plate')
    .trim()
    .notEmpty()
    .withMessage('Biển số không được để trống')
    .isLength({ max: 20 })
    .withMessage('Biển số quá dài'),
  body('vehicleType')
    .trim()
    .notEmpty()
    .withMessage('Loại xe không được để trống')
    .isIn(['CAR', 'MOTORBIKE'])
    .withMessage('Loại xe không hợp lệ'),
  body('customerType')
    .trim()   
    .notEmpty()
    .withMessage('Loại khách không được để trống')
    .isIn(['monthly', 'casual'])
    .withMessage('Loại khách không hợp lệ'),
  body('slotCode')
    .custom((value, { req }) => {
      if (req.body.customerType === 'monthly' && req.body.vehicleType === 'CAR') {
        return true;
      }
      if (!value || value.trim() === '') {
        throw new Error('Mã slot không được để trống');
      }
      return true;
    }),
  body('isMonthly')
    .isBoolean()
    .withMessage('isMonthly phải là boolean'),
];
