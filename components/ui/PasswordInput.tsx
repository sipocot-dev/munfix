"use client";

import { useState } from "react";
import Icon from "./Icon";

/** Password field with a show/hide toggle, so people on phones can check what they typed. */
export default function PasswordInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`field !pr-12 ${props.className ?? ""}`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      >
        <Icon name={visible ? "eyeOff" : "eye"} className="h-4.5 w-4.5" />
      </button>
    </div>
  );
}
