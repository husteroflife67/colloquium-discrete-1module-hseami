import React from "react";
import katex from "katex";
export function MathText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\$[^$]+\$)/g)
        .map((s, i) =>
          s.startsWith("$") ? (
            <span
              className="math-run"
              key={i}
              dangerouslySetInnerHTML={{
                __html: katex.renderToString(s.slice(1, -1), {
                  throwOnError: false,
                  strict: "ignore",
                  trust: false,
                }),
              }}
            />
          ) : (
            <React.Fragment key={i}>{s}</React.Fragment>
          ),
        )}
    </>
  );
}
