export const generateSlug = (text: string): string => {
  const base = text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  const suffix = Math.random().toString(36).substring(2, 7);
  return `${base}-${suffix}`;
};
