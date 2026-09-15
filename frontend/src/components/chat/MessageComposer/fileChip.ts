export type FileChipKind =
  | 'presentation'
  | 'document'
  | 'spreadsheet'
  | 'pdf'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'text'
  | 'file';

const PRESENTATION_EXT = new Set(['ppt', 'pptx', 'odp', 'key']);
const DOCUMENT_EXT = new Set(['doc', 'docx', 'odt', 'rtf', 'pages']);
const SPREADSHEET_EXT = new Set(['xls', 'xlsx', 'ods', 'csv', 'tsv']);
const PDF_EXT = new Set(['pdf']);
const IMAGE_EXT = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'bmp',
  'heic'
]);
const VIDEO_EXT = new Set(['mp4', 'mov', 'webm', 'mkv', 'avi']);
const AUDIO_EXT = new Set(['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac']);
const ARCHIVE_EXT = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'tgz']);
const TEXT_EXT = new Set(['txt', 'md', 'json', 'xml', 'yml', 'yaml', 'log']);

/**
 * Split a file name into the visible title and a lowercase extension.
 * Names without a real extension keep the full name as the title.
 */
export const splitFileChipName = (
  name: string
): { title: string; extension: string } => {
  const trimmed = String(name || '').trim();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return { title: trimmed, extension: '' };
  }
  return {
    title: trimmed.slice(0, lastDot),
    extension: trimmed.slice(lastDot + 1).toLowerCase()
  };
};

/**
 * Map mime type and extension onto a closed file-kind used for i18n labels.
 */
export const resolveFileChipKind = (
  mime: string,
  extension: string
): FileChipKind => {
  const normalizedMime = String(mime || '')
    .trim()
    .toLowerCase();
  const ext = String(extension || '')
    .trim()
    .toLowerCase();

  if (normalizedMime.startsWith('image/') || IMAGE_EXT.has(ext)) {
    return 'image';
  }
  if (normalizedMime.startsWith('video/') || VIDEO_EXT.has(ext)) {
    return 'video';
  }
  if (normalizedMime.startsWith('audio/') || AUDIO_EXT.has(ext)) {
    return 'audio';
  }
  if (normalizedMime === 'application/pdf' || PDF_EXT.has(ext)) {
    return 'pdf';
  }
  if (
    normalizedMime.includes('presentation') ||
    normalizedMime.includes('powerpoint') ||
    PRESENTATION_EXT.has(ext)
  ) {
    return 'presentation';
  }
  if (
    normalizedMime.includes('spreadsheet') ||
    normalizedMime.includes('excel') ||
    SPREADSHEET_EXT.has(ext)
  ) {
    return 'spreadsheet';
  }
  if (
    normalizedMime.includes('word') ||
    normalizedMime.includes('msword') ||
    DOCUMENT_EXT.has(ext)
  ) {
    return 'document';
  }
  if (
    normalizedMime.includes('zip') ||
    normalizedMime.includes('compressed') ||
    ARCHIVE_EXT.has(ext)
  ) {
    return 'archive';
  }
  if (normalizedMime.startsWith('text/') || TEXT_EXT.has(ext)) {
    return 'text';
  }
  return 'file';
};
