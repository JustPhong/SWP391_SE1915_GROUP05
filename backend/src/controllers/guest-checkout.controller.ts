import { Response } from 'express';
import { GuestCheckoutService } from '../services/guestCheckout.service';

export class GuestCheckoutController {
  static async lookup(req: any, res: Response) {
    try {
      const { code } = req.params;
      const result = await GuestCheckoutService.lookupByGuestCode(code);
      return res.json({ success: true, data: result });
    } catch {
      return res.status(500).json({ success: false, message: 'Không thể tra cứu mã khách.' });
    }
  }

  static async prepay(req: any, res: Response) {
    try {
      const { code } = req.params;
      const { method } = req.body;
      if (!method || !['CASH', 'CARD', 'EWALLET'].includes(method)) {
        return res.status(400).json({ success: false, message: 'Phương thức thanh toán không hợp lệ.' });
      }
      const result = await GuestCheckoutService.prepay(code, method);
      if (!result.ok) {
        return res.status(400).json({ success: false, message: result.message || 'Thanh toán trước thất bại.' });
      }
      return res.json({ success: true, data: result });
    } catch {
      return res.status(500).json({ success: false, message: 'Không thể thanh toán trước.' });
    }
  }

  static async payOverstay(req: any, res: Response) {
    try {
      const { code } = req.params;
      const { method } = req.body;
      if (!method || !['CASH', 'CARD', 'EWALLET'].includes(method)) {
        return res.status(400).json({ success: false, message: 'Phương thức thanh toán không hợp lệ.' });
      }
      const result = await GuestCheckoutService.payOverstay(code, method);
      if (!result.ok) {
        return res.status(400).json({ success: false, message: result.message || 'Thanh toán phí phát sinh thất bại.' });
      }
      return res.json({ success: true, data: result });
    } catch {
      return res.status(500).json({ success: false, message: 'Không thể thanh toán phí phát sinh.' });
    }
  }

  static async confirmExit(req: any, res: Response) {
    try {
      const { code } = req.params;
      const result = await GuestCheckoutService.confirmExit(code);
      return res.json({ success: true, data: result });
    } catch (err) {
      return res.status(400).json({ success: false, message: err instanceof Error ? err.message : 'Xác nhận xe ra cổng thất bại.' });
    }
  }
}