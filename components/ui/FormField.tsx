import { cloneElement, isValidElement, useId } from "react";

/**
 * Label + control + hint, wired with htmlFor/aria-describedby. Pass exactly one input, select or textarea
 * as the child; its id and aria-describedby are filled in. Works in server and client components.
 */
export default function FormField({
  label,
  hint,
  optional,
  children,
  className = "",
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  optional?: boolean;
  children: React.ReactElement<{ id?: string; "aria-describedby"?: string }>;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, { id: children.props.id ?? id, "aria-describedby": hintId })
    : children;
  return (
    <div className={className}>
      <label htmlFor={children.props.id ?? id} className="label">
        {label}
        {optional && <span className="ml-1 font-normal text-fg-muted">(optional)</span>}
      </label>
      <div className="mt-1.5">{control}</div>
      {hint && (
        <p id={hintId} className="hint">
          {hint}
        </p>
      )}
    </div>
  );
}
