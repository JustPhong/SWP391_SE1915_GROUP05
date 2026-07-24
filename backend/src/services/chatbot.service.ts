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

    const thisMonthTotal = comparison?.thisMonth?.total ?? monthDetail?.total ?? 0;
    const lastMonthTotal = comparison?.lastMonthSamePeriod?.total ?? 0;
    const diff = thisMonthTotal - lastMonthTotal;
    const diffPercent = lastMonthTotal > 0 ? ((diff / lastMonthTotal) * 100).toFixed(1) : null;

    let growthAssessment = 'Không thay đổi';
    if (diff > 0) {
      growthAssessment = `Tăng trưởng +${fmtVnd(diff)}${diffPercent ? ` (+${diffPercent}%)` : ''}`;
    } else if (diff < 0) {
      growthAssessment = `Sụt giảm -${fmtVnd(Math.abs(diff))}${diffPercent ? ` (${diffPercent}%)` : ''}`;
    }

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
        thangNay: fmtVnd(thisMonthTotal),
        thangTruocCungKy: fmtVnd(lastMonthTotal),
        chenhLech: diff >= 0 ? `+${fmtVnd(diff)}` : `-${fmtVnd(Math.abs(diff))}`,
        danhGiaXuHuong: growthAssessment,
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

QUY TẮC TRẢ LỜI MANDATORY:
1. Trả lời bằng Tiếng Việt chuẩn mực, lịch sự, chuyên nghiệp.
2. Trả lời NGẮN GỌN (từ 2 đến 4 câu) nhưng ĐẦY ĐỦ CON SỐ CỤ THỂ (VNĐ, số lượt xe, tỷ lệ %).
3. Nêu rõ phân bổ giữa Khách lẻ và Gói tháng khi được hỏi về doanh thu.
4. KHÔNG đưa ra số liệu hư cấu ngoài dữ liệu JSON ở trên.
5. QUAN TRỌNG VỀ ĐÁNH GIÁ TĂNG TRƯỞNG / SỤT GIẢM:
   - Phải căn cứ CHÍNH XÁC vào số liệu trong JSON (\`soSanhThangNayVoiThangTruoc\`).
   - Nếu doanh thu tháng này THẤP HƠN tháng trước (chênh lệch âm, ví dụ: 60.000 VNĐ vs 4.000.000 VNĐ), BẮT BUỘC nhận xét là doanh thu "SỤT GIẢM" hoặc "GIẢM" và nêu rõ mức sụt giảm.
   - TUYỆT ĐỐI KHÔNG ĐƯỢC nhận xét là "tăng trưởng tích cực" hay "tăng" khi số liệu doanh thu thực tế bị giảm hoặc kém hơn.
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

    let growthTrendText = '';
    if (diff > 0) {
      const pct = diffPercent ? ` (+${diffPercent}%)` : '';
      growthTrendText = `doanh thu ghi nhận tăng trưởng ${fmtVnd(diff)}${pct}!`;
    } else if (diff < 0) {
      const pct = diffPercent ? ` (${diffPercent}%)` : '';
      growthTrendText = `doanh thu sụt giảm ${fmtVnd(Math.abs(diff))}${pct} so với cùng kỳ tháng trước.`;
    } else {
      growthTrendText = `doanh thu không thay đổi so với cùng kỳ tháng trước.`;
    }

    if (qLower.includes('gói tháng') || qLower.includes('goi thang')) {
      return `💳 **Thống kê Doanh thu Gói tháng:**\n- Doanh thu Gói tháng hiện tại (tháng này): **${systemContext.doanhThuThangNay.doanhThuGoiThang}**\n- Doanh thu Gói tháng hôm nay: **${systemContext.doanhThuHomNay.doanhThuGoiThang}**\n- Tổng doanh thu toàn hệ thống tháng này: **${systemContext.doanhThuThangNay.tongDoanhThu}** (Khách lẻ: ${systemContext.doanhThuThangNay.doanhThuKhachLe})\n- So với cùng kỳ tháng trước (**${systemContext.soSanhThangNayVoiThangTruoc.thangTruocCungKy}**), ${growthTrendText}`;
    }

    if (qLower.includes('hôm nay') || qLower.includes('hom nay')) {
      return `📊 **Doanh thu hôm nay (${systemContext.thoiGianHienTai.split(' ')[0]}):**\n- Tổng doanh thu: **${systemContext.doanhThuHomNay.tongDoanhThu}**\n- Khách lẻ: **${systemContext.doanhThuHomNay.doanhThuKhachLe}**\n- Gói tháng: **${systemContext.doanhThuHomNay.doanhThuGoiThang}**\n- Lượt xe ra/vào: **${systemContext.doanhThuHomNay.luotXeRaVao} lượt xe**.`;
    }

    if (qLower.includes('tháng') || qLower.includes('thang') || qLower.includes('so sánh') || qLower.includes('so sanh')) {
      return `📈 **Thống kê & So sánh Doanh thu tháng này:**\n- Tổng doanh thu tháng: **${systemContext.doanhThuThangNay.tongDoanhThu}**\n- Doanh thu Khách lẻ: **${systemContext.doanhThuThangNay.doanhThuKhachLe}**\n- Doanh thu Gói tháng: **${systemContext.doanhThuThangNay.doanhThuGoiThang}**\n- So với cùng kỳ tháng trước (**${systemContext.soSanhThangNayVoiThangTruoc.thangTruocCungKy}**), ${growthTrendText}`;
    }

    return `💡 **Báo cáo tổng quan bãi đỗ xe hiện tại:**\n- **Tổng doanh thu tích lũy tháng:** ${systemContext.doanhThuThangNay.tongDoanhThu} (Khách lẻ: ${systemContext.doanhThuThangNay.doanhThuKhachLe} | Gói tháng: ${systemContext.doanhThuThangNay.doanhThuGoiThang}).\n- **Trạng thái bãi xe:** Tỷ lệ lấp đầy **${systemContext.tinhTrangBaiXe.tyLeLapDay}** (${systemContext.tinhTrangBaiXe.dangSuDung}/${systemContext.tinhTrangBaiXe.tongSucChua} vị trí đang đỗ).\n- **So với tháng trước:** ${growthTrendText}`;
  },
};
