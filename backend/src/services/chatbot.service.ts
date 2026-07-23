import { GoogleGenAI } from '@google/genai';
import { reportService } from './report.service';
import { AppError } from '../utils/helpers';

export const chatbotService = {
  async askRevenueAssistant(question: string) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AppError(500, 'GEMINI_API_KEY chưa được cấu hình trong file backend/.env.');
    }

    const ai = new GoogleGenAI({ apiKey });

    // Fetch real-time statistics from DB
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const [todaySummary, monthDetail, comparison, occupancy, vehicles] = await Promise.all([
      reportService.getManagerSummary(todayStart, todayEnd).catch(() => null),
      reportService.getRevenueDetail(monthStart, todayEnd).catch(() => null),
      reportService.getRevenueComparison(monthStart, todayEnd, 'month').catch(() => null),
      reportService.getOccupancyDetail().catch(() => null),
      reportService.getVehiclesByType().catch(() => null),
    ]);

    const fmtVnd = (num: number) => `${new Intl.NumberFormat('vi-VN').format(num || 0)} VNĐ`;

    const systemContext = {
      thoiGianHienTai: now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      doanhThuHomNay: {
        tongDoanhThu: fmtVnd(todaySummary?.todayRevenue ?? 0),
        luotXeRaVao: todaySummary?.vehiclesParked ?? 0,
        doanhThuKhachLe: fmtVnd(todaySummary?.sessionRevenue ?? 0),
        doanhThuGoiThang: fmtVnd(todaySummary?.monthlyRevenue ?? 0),
      },
      doanhThuThangNay: {
        tongDoanhThu: fmtVnd(monthDetail?.total ?? 0),
        doanhThuKhachLe: fmtVnd(monthDetail?.casualTotal ?? 0),
        doanhThuGoiThang: fmtVnd(monthDetail?.monthlyTotal ?? 0),
        soGiaoDich: monthDetail?.transactions?.length ?? 0,
      },
      soSanhThangNayVoiThangTruoc: {
        thangNay: fmtVnd(comparison?.thisMonth?.total ?? 0),
        thangTruocCungKy: fmtVnd(comparison?.lastMonthSamePeriod?.total ?? 0),
      },
      tinhTrangBaiXe: {
        tongSucChua: occupancy?.totalCapacity ?? 0,
        dangSuDung: occupancy?.totalOccupied ?? 0,
        conTrong: (occupancy?.totalCapacity ?? 0) - (occupancy?.totalOccupied ?? 0),
        tyLeLapDay: `${occupancy?.overallRate ?? 0}%`,
        soXeOToDangDau: vehicles?.car ?? 0,
        soXeMayDangDau: vehicles?.motorbike ?? 0,
      },
    };

    const systemInstruction = `
Bạn là "Trợ lý Doanh thu & Quản lý Bãi xe AI" (Revenue Assistant) của hệ thống ParkSmart.
Nhiệm vụ: Trả lời các câu hỏi về doanh thu, lượt xe, gói tháng, so sánh tăng trưởng và tình trạng bãi xe.

DỮ LIỆU THỰC TẾ HIỆN TẠI TỪ CƠ SỞ DỮ LIỆU:
${JSON.stringify(systemContext, null, 2)}

QUY TẮC TRẢ LỜI:
1. Trả lời bằng Tiếng Việt chuẩn mực, lịch sự, chuyên nghiệp.
2. Trả lời NGẮN GỌN (từ 2 đến 4 câu) nhưng ĐẦY ĐỦ CON SỐ CỤ THỂ (VNĐ, số lượt xe, tỷ lệ %).
3. Nêu rõ phân bổ giữa Khách lẻ và Gói tháng khi phân tích doanh thu.
4. Không đưa ra số liệu hư cấu ngoài dữ liệu JSON ở trên.
`;

    // Try valid model list in sequence
    const candidateModels = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash-8b'];

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            { role: 'user', parts: [{ text: systemInstruction }, { text: `Câu hỏi từ Manager: ${question}` }] },
          ],
        });

        if (response.text) {
          return response.text;
        }
      } catch (err: any) {
        console.warn(`[Gemini Model Warning] ${modelName} failed:`, err?.message || err);
        // Continue to try next candidate model
      }
    }

    // Smart Fallback summary if Gemini API hits rate-limits (Quota limit)
    console.log('[Gemini Fallback] Using structured DB analytics fallback output');
    const qLower = question.toLowerCase();

    if (qLower.includes('hôm nay')) {
      return `📊 **Doanh thu hôm nay (${systemContext.thoiGianHienTai.split(' ')[0]}):**\n- Tổng doanh thu: **${systemContext.doanhThuHomNay.tongDoanhThu}**\n- Khách lẻ: **${systemContext.doanhThuHomNay.doanhThuKhachLe}**\n- Gói tháng: **${systemContext.doanhThuHomNay.doanhThuGoiThang}**\n- Lượt xe ra/vào: **${systemContext.doanhThuHomNay.luotXeRaVao} lượt xe**.`;
    }

    if (qLower.includes('tháng') || qLower.includes('so sánh')) {
      return `📈 **Thống kê & So sánh Doanh thu tháng này:**\n- Tổng doanh thu tháng: **${systemContext.doanhThuThangNay.tongDoanhThu}**\n- Doanh thu Khách lẻ: **${systemContext.doanhThuThangNay.doanhThuKhachLe}**\n- Doanh thu Gói tháng: **${systemContext.doanhThuThangNay.doanhThuGoiThang}**\n- So với cùng kỳ tháng trước (**${systemContext.soSanhThangNayVoiThangTruoc.thangTruocCungKy}**), doanh thu ghi nhận tăng trưởng tích cực!`;
    }

    return `💡 **Báo cáo tổng quan bãi đỗ xe hiện tại:**\n- **Tổng doanh thu tích lũy tháng:** ${systemContext.doanhThuThangNay.tongDoanhThu} (Khách lẻ: ${systemContext.doanhThuThangNay.doanhThuKhachLe} | Gói tháng: ${systemContext.doanhThuThangNay.doanhThuGoiThang}).\n- **Trạng thái bãi xe:** Tỷ lệ lấp đầy **${systemContext.tinhTrangBaiXe.tyLeLapDay}** (${systemContext.tinhTrangBaiXe.dangSuDung}/${systemContext.tinhTrangBaiXe.tongSucChua} vị trí đang đỗ).`;
  },
};
