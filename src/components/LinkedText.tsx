import { Fragment } from "react";

export default function LinkedText({ text }: { text: string }) {
  return <>{text.split(/(https?:\/\/[^\s<>"']+)/gi).map((part, index) => {
    if (!/^https?:\/\//i.test(part)) return <Fragment key={index}>{part}</Fragment>;
    let link = part.replace(/[.,;!?]+$/, "");
    for (const [open, close] of [["(", ")"], ["[", "]"]]) {
      while (link.endsWith(close) && link.split(close).length > link.split(open).length) {
        link = link.slice(0, -1);
      }
    }
    try {
      new URL(link);
    } catch {
      return <Fragment key={index}>{part}</Fragment>;
    }
    return <Fragment key={index}>
      <a href={link} target="_blank" rel="noopener noreferrer" className="break-all text-cyan-700 underline dark:text-cyan-300">
        {link}
      </a>
      {part.slice(link.length)}
    </Fragment>;
  })}</>;
}
