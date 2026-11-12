import path from 'path';

export const ALLOWED_AUDIO_TYPES = [
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/opus',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
];

export const ALLOWED_CHAT_DOCUMENT_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.csv',
  '.zip',
]);

export const MAX_CHAT_IMAGE_SIZE = 15 * 1024 * 1024; // 15 MB per image
export const MAX_CHAT_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB per video
export const MAX_CHAT_AUDIO_SIZE = 25 * 1024 * 1024; // 25 MB per voice/audio clip
export const MAX_CHAT_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25 MB per document

export type ChatMediaKind = 'image' | 'video' | 'voice' | 'audio' | 'document';

export function sanitizeFilename(rawName: string): string {
  const base = path.posix.basename((rawName || 'file').replace(/\\/g, '/'));
  const cleaned = base
    .replace(/[\x00-\x1f\x7f<>:"/\\|?*]+/g, '_')
    .replace(/\.{2,}/g, '.')
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 180) : 'attachment';
}

export function sanitizeFolder(rawFolder?: string, defaultFolder = 'chat/media'): string {
  const raw = (rawFolder || defaultFolder).replace(/\\/g, '/');
  const parts = raw
    .split('/')
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p !== '.' && p !== '..' && /^[a-zA-Z0-9_-]+$/.test(p));
  return parts.length > 0 ? parts.join('/') : defaultFolder;
}

export function inferAttachmentKind(mimeType?: string, filename?: string): ChatMediaKind {
  const mime = (mimeType || '').toLowerCase();
  const ext = path.extname(filename || '').toLowerCase();

  if (mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif'].includes(ext)) {
    return 'image';
  }
  if (mime.startsWith('video/') || ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.3gp'].includes(ext)) {
    return 'video';
  }
  if (mime.startsWith('audio/') || ['.m4a', '.aac', '.mp3', '.ogg', '.opus', '.wav'].includes(ext)) {
    return 'voice';
  }
  return 'document';
}

export function maxSizeForKind(kind: ChatMediaKind): number {
  switch (kind) {
    case 'image':
      return MAX_CHAT_IMAGE_SIZE;
    case 'video':
      return MAX_CHAT_VIDEO_SIZE;
    case 'voice':
    case 'audio':
      return MAX_CHAT_AUDIO_SIZE;
    case 'document':
      return MAX_CHAT_DOCUMENT_SIZE;
  }
}

export function isAllowedChatMimeAndExtension(mimeType: string, filename: string, kind: ChatMediaKind): boolean {
  const mime = (mimeType || '').toLowerCase().split(';')[0].trim();
  const ext = path.extname(filename || '').toLowerCase();

  if (kind === 'image') {
    const validMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'].includes(mime);
    const validExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif'].includes(ext);
    return validMime || (mime === 'application/octet-stream' && validExt) || (!mime && validExt);
  }

  if (kind === 'video') {
    const validMime = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/x-matroska', 'video/3gpp'].includes(mime);
    const validExt = ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.3gp', '.avi'].includes(ext);
    return validMime || (mime === 'application/octet-stream' && validExt) || (!mime && validExt);
  }

  if (kind === 'voice' || kind === 'audio') {
    const validMime = ALLOWED_AUDIO_TYPES.includes(mime) || mime === 'video/mp4'; // .m4a sometimes reports video/mp4
    const validExt = ['.m4a', '.aac', '.mp3', '.ogg', '.opus', '.wav', '.webm', '.mp4'].includes(ext);
    return validMime || (mime === 'application/octet-stream' && validExt) || (!mime && validExt);
  }

  // Document
  const validDocMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/csv',
    'application/zip',
    'application/x-zip-compressed',
  ];
  return validDocMimes.includes(mime) || ALLOWED_CHAT_DOCUMENT_EXTENSIONS.has(ext);
}

/**
 * Lightweight magic-byte signature verification to reject executable/spoofed payloads.
 */
export function verifyMagicBytes(buffer: Buffer, kind: ChatMediaKind, mimeType: string, filename: string): boolean {
  if (!buffer || buffer.length < 4) {
    // Allow tiny valid plain-text / csv files >= 1 byte
    const ext = path.extname(filename || '').toLowerCase();
    return kind === 'document' && ['.txt', '.csv'].includes(ext) && buffer.length > 0;
  }

  const ext = path.extname(filename || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  // Always block Windows/Linux/macOS binary executables (MZ, ELF, Mach-O)
  if (
    (buffer[0] === 0x4d && buffer[1] === 0x5a) || // MZ (.exe/.dll)
    (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) || // ELF
    (buffer[0] === 0xfe && buffer[1] === 0xed && buffer[2] === 0xfa) // Mach-O
  ) {
    return false;
  }

  if (kind === 'image') {
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isGif = buffer.subarray(0, 4).toString('ascii') === 'GIF8';
    const isWebp =
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    const isIsoBmff = buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
    return isJpeg || isPng || isGif || isWebp || isIsoBmff;
  }

  if (kind === 'video') {
    const isMp4OrMov = buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
    const isEbml = buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3; // webm/mkv
    const isAvi = buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'AVI ';
    return isMp4OrMov || isEbml || isAvi;
  }

  if (kind === 'voice' || kind === 'audio') {
    const isM4aOrMp4 = buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
    const isOgg = buffer.subarray(0, 4).toString('ascii') === 'OggS';
    const isWav =
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WAVE';
    const isMp3Id3 = buffer.subarray(0, 3).toString('ascii') === 'ID3';
    const isMpegOrAacFrame = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
    const isEbml = buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
    const isCaf = buffer.subarray(0, 4).toString('ascii') === 'caff';
    return isM4aOrMp4 || isOgg || isWav || isMp3Id3 || isMpegOrAacFrame || isEbml || isCaf;
  }

  // Documents
  if (ext === '.pdf' || mime === 'application/pdf') {
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  if (['.docx', '.xlsx', '.pptx', '.zip'].includes(ext)) {
    return buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);
  }
  if (['.doc', '.xls', '.ppt'].includes(ext)) {
    return buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
  }
  if (['.txt', '.csv'].includes(ext) || mime.startsWith('text/')) {
    const sample = buffer.subarray(0, Math.min(buffer.length, 512));
    return !sample.includes(0x00);
  }

  return true;
}

