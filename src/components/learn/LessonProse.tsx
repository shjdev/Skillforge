'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { L } from '@/lib/theme';

const serif = { fontFamily: 'var(--font-serif-display)' };

export function LessonProse({ content }: { content: string }) {
  return (
    <div style={{ fontFamily: 'var(--font-serif-display)', fontSize: 19, lineHeight: 1.72, fontWeight: 300, color: 'oklch(0.28 0.014 60)', maxWidth: '66ch' }}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h2 style={{ ...serif, fontSize: 26, fontWeight: 400, margin: '0 0 16px', color: L.ink }}>{children}</h2>,
          h2: ({ children }) => <h3 style={{ ...serif, fontSize: 22, fontWeight: 400, margin: '28px 0 14px', color: L.ink }}>{children}</h3>,
          h3: ({ children }) => <h4 style={{ ...serif, fontSize: 19, fontWeight: 500, margin: '24px 0 10px', color: L.ink }}>{children}</h4>,
          p: ({ children }) => <p style={{ margin: '0 0 20px' }}>{children}</p>,
          strong: ({ children }) => <strong style={{ fontWeight: 600, color: L.ink }}>{children}</strong>,
          em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
          ul: ({ children }) => <ul style={{ margin: '0 0 20px', paddingLeft: 22 }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ margin: '0 0 20px', paddingLeft: 22 }}>{children}</ol>,
          li: ({ children }) => <li style={{ marginBottom: 8 }}>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote
              style={{
                margin: '0 0 20px',
                paddingLeft: 16,
                borderLeft: `2px solid ${L.rule}`,
                color: L.ink2,
                fontSize: 16,
              }}
            >
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code style={{ fontFamily: 'var(--font-mono-ui)', fontSize: 15, background: L.paper3, padding: '1px 5px' }}>{children}</code>
          ),
          hr: () => <div style={{ height: 1, background: L.rule, margin: '28px 0' }} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
