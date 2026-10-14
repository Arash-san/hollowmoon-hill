// Light chat and name hygiene for a student party: strips control characters and masks common slurs/profanity.
const WORDS = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'asshole', 'bastard', 'nigger', 'nigga', 'faggot', 'fag', 'retard', 'slut', 'whore', 'cock', 'rape', 'nazi', 'kys'];
const RE = new RegExp(`(${WORDS.map((w) => w.split('').join('[\\W_]*')).join('|')})`, 'gi');

export function clean(text, max = 140) {
  return String(text ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .replace(RE, (m) => m[0] + '*'.repeat(Math.max(1, m.length - 1)));
}

export function cleanName(name) {
  const n = clean(name, 16).replace(/[^\p{L}\p{N} _.'-]/gu, '').trim();
  return n.length >= 2 ? n : '';
}
