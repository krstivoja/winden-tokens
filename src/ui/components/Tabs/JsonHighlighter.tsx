// JSON syntax highlighter component

import React from 'react';

interface JsonHighlighterProps {
  json: string;
  className?: string;
}

/**
 * Highlights JSON syntax with different colors for different token types
 */
export function JsonHighlighter({ json, className = '' }: JsonHighlighterProps) {
  const highlightJson = (jsonString: string): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    let key = 0;

    // Regex to match JSON tokens
    const regex = /"([^"]+)"(?=\s*:)|"([^"]*)"|(\btrue\b|\bfalse\b)|(\bnull\b)|(-?\d+\.?\d*)|([{}[\],:])/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(jsonString)) !== null) {
      // Add any text before the match (whitespace/formatting)
      if (match.index > lastIndex) {
        nodes.push(
          <span key={`ws-${key++}`}>
            {jsonString.substring(lastIndex, match.index)}
          </span>
        );
      }

      const [fullMatch, jsonKey, stringValue, jsonBoolean, jsonNull, jsonNumber, jsonPunctuation] = match;

      if (jsonKey !== undefined) {
        // Object key
        nodes.push(
          <span key={`key-${key++}`} className="json-key">
            "{jsonKey}"
          </span>
        );
      } else if (stringValue !== undefined) {
        // String value
        nodes.push(
          <span key={`str-${key++}`} className="json-string">
            "{stringValue}"
          </span>
        );
      } else if (jsonBoolean !== undefined) {
        // Boolean
        nodes.push(
          <span key={`bool-${key++}`} className="json-boolean">
            {jsonBoolean}
          </span>
        );
      } else if (jsonNull !== undefined) {
        // Null
        nodes.push(
          <span key={`null-${key++}`} className="json-null">
            {jsonNull}
          </span>
        );
      } else if (jsonNumber !== undefined) {
        // Number
        nodes.push(
          <span key={`num-${key++}`} className="json-number">
            {jsonNumber}
          </span>
        );
      } else if (jsonPunctuation !== undefined) {
        // Punctuation
        nodes.push(
          <span key={`punc-${key++}`} className="json-punctuation">
            {jsonPunctuation}
          </span>
        );
      }

      lastIndex = regex.lastIndex;
    }

    // Add any remaining text
    if (lastIndex < jsonString.length) {
      nodes.push(
        <span key={`end-${key++}`}>
          {jsonString.substring(lastIndex)}
        </span>
      );
    }

    return nodes;
  };

  return (
    <div className={`json-highlight ${className}`}>
      {highlightJson(json)}
    </div>
  );
}
