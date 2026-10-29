import React from "react";
import katex from "katex";
export function MathText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\$\$[\s\S]*?\$\$|\$[^$]+\$)/g).map((p, i) =>
        p.startsWith("$") ? (
          <span
            key={i}
            className="formula"
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(p.replace(/^\$\$?|\$\$?$/g, ""), {
                throwOnError: false,
                displayMode: p.startsWith("$$"),
                strict: "ignore",
                trust: false,
              }),
            }}
          />
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}
