export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
export const MAX_RECORD_SECONDS = 60;

export function photoError(file) {
  if (!file || !file.size) return 'Choose a photo that contains image data.';
  if (file.size > MAX_MEDIA_BYTES) return 'Choose a photo smaller than 10 MB.';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return 'Choose a JPG, PNG, or WEBP photo.';
  }
  return '';
}

export function audioError(file) {
  if (!file || !file.size) return 'Choose an audio file that contains a recording.';
  if (file.size > MAX_MEDIA_BYTES) return 'Choose an audio file smaller than 10 MB.';
  if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|wav|webm|ogg|aac|flac)$/i.test(file.name)) {
    return 'Choose an audio file, such as MP3, M4A, WAV, or WEBM.';
  }
  return '';
}

export function formatTime(seconds) {
  const wholeSeconds = Math.max(0, Math.floor(seconds || 0));
  return Math.floor(wholeSeconds / 60) + ':' + String(wholeSeconds % 60).padStart(2, '0');
}
