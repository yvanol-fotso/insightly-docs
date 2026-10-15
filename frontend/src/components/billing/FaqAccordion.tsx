import { useState } from "react";
import { ChevronDownIcon } from "../ui/Icons";

export interface FaqItem {
  question: string;
  answer: string;
}

function FaqAccordionItem({ question, answer }: FaqItem) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`faq-item ${open ? "faq-item--open" : ""}`}>
      <button className="faq-item__trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="faq-item__question">{question}</span>
        <span className="faq-item__icon">
          <ChevronDownIcon />
        </span>
      </button>

      <div className="faq-item__panel">
        <div className="faq-item__panel-inner">
          <p>{answer}</p>
        </div>
      </div>
    </div>
  );
}

export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <div className="faq-list">
      {items.map((item) => (
        <FaqAccordionItem key={item.question} {...item} />
      ))}
    </div>
  );
}
