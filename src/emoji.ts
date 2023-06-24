const emojiRegex = /:(\w+):/g;
const emojiMap: { [key: string]: string } = {
  'scream': '😱',
};

export default function unshortifyEmoji(text: string): string {
  return text.replace(emojiRegex, (match, p1) => {
    const emoji = emojiMap[p1];
    return emoji
  });
}
