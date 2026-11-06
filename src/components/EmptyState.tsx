import type { ReactNode } from "react";
import { InfoCircleIcon } from "../icons";

/** Keep recovery guidance beside the state that needs attention. */
export function EmptyState({ message, title, action, headingLevel = 3 }: {
  message: string;
  title?: string;
  action?: ReactNode;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="empty-state">
      <span className="empty-state-symbol" aria-hidden="true"><InfoCircleIcon size={24} /></span>
      {title ? <Heading>{title}</Heading> : null}
      <p>{message}</p>
      {action}
    </div>
  );
}
