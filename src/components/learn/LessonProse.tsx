import ReactMarkdown from 'react-markdown';

/**
 * Contenu d'une leçon (markdown généré par l'IA). Le HTML brut n'est pas
 * interprété : seul le markdown est rendu.
 */
export function LessonProse({ content }: { content: string }) {
  return (
    <div className="prose-lesson max-w-[68ch]">
      <ReactMarkdown
        skipHtml
        components={{
          // Un seul h1 par page : les titres de la leçon commencent au niveau 2.
          h1: ({ children }) => <h2>{children}</h2>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
