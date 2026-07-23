import { Response } from 'express';
import { chatbotService } from '../services/chatbot.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler, AppError } from '../utils/helpers';

export const chatbotController = {
  ask: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { question, message } = req.body;
    const prompt = question || message;

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      throw new AppError(400, 'Vui lòng nhập câu hỏi cho Trợ lý AI.');
    }

    const answer = await chatbotService.askRevenueAssistant(prompt.trim());
    return res.status(200).json({
      success: true,
      data: {
        answer,
        timestamp: new Date().toISOString(),
      },
    });
  }),
};
