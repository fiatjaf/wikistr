import plainText from 'markdown-it-plain-text';
import MarkdownIt from 'markdown-it';

const mdTxt = new MarkdownIt().use(plainText);

export function parsePlainText(markdown: string) {
  mdTxt.render(markdown);

  const parsedText = (mdTxt as any).plainText.replace(/\[\[(.*?)\]\]/g, (_: any, content: any) => {
    return content;
  });

  return parsedText;
}
