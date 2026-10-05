import QRCode from 'qrcode';
import { logger } from '../../config/logger';

export class QrGenerator {
  static async generateDataUrl(payload: string): Promise<string> {
    try {
      return await QRCode.toDataURL(payload, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 300,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
    } catch (error: any) {
      logger.error('Failed to generate QR data URL', { error: error.message });
      throw error;
    }
  }

  static async generateBuffer(payload: string): Promise<Buffer> {
    try {
      return await QRCode.toBuffer(payload, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 300,
      });
    } catch (error: any) {
      logger.error('Failed to generate QR buffer', { error: error.message });
      throw error;
    }
  }
}
