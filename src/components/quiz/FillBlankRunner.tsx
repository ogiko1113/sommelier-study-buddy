import { Fragment, useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  renderSegments,
  type Blank,
} from "@/lib/fill-blank-judge";

interface Props {
  questionText: string;
  blanks: Blank[];
  inputMode: "text" | "select";
  inputs: Record<number, string>;
  onChange: (idx: number, value: string) => void;
  revealed: boolean;
  perBlank?: Record<number, boolean>;
  disabled?: boolean;
}

export function FillBlankRunner({
  questionText,
  blanks,
  inputMode,
  inputs,
  onChange,
  revealed,
  perBlank,
  disabled,
}: Props) {
  const segments = useMemo(() => renderSegments(questionText), [questionText]);
  const blankMap = useMemo(() => {
    const m = new Map<number, Blank>();
    for (const b of blanks) m.set(b.index, b);
    return m;
  }, [blanks]);

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-lg leading-loose text-foreground">
        {segments.map((seg, i) => {
          if (seg.kind === "text") {
            return (
              <Fragment key={i}>
                {seg.value.split("\n").map((line, li, arr) => (
                  <Fragment key={li}>
                    {line}
                    {li < arr.length - 1 && <br />}
                  </Fragment>
                ))}
              </Fragment>
            );
          }
          const b = blankMap.get(seg.index);
          const value = inputs[seg.index] ?? "";
          const ok = perBlank?.[seg.index];
          let stateCls = "";
          if (revealed) {
            stateCls = ok
              ? "border-primary text-primary"
              : "border-destructive text-destructive line-through";
          }
          if (inputMode === "select" && b) {
            return (
              <select
                key={i}
                value={value}
                onChange={(e) => onChange(seg.index, e.target.value)}
                disabled={disabled || revealed}
                className={`mx-1 inline-block h-9 max-w-[12em] rounded-md border border-input bg-background px-2 align-baseline text-base ${stateCls}`}
                aria-label={`空欄 ${seg.index}`}
              >
                <option value="">{`{{${seg.index}}}`}</option>
                {(b.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            );
          }
          return (
            <Input
              key={i}
              value={value}
              onChange={(e) => onChange(seg.index, e.target.value)}
              disabled={disabled || revealed}
              placeholder={`{{${seg.index}}}`}
              className={`mx-1 inline-block h-9 w-[10em] align-baseline text-base ${stateCls}`}
              aria-label={`空欄 ${seg.index}`}
            />
          );
        })}
      </p>

      {revealed && (
        <div className="mt-4 space-y-1 border-t pt-3 text-sm">
          {blanks.map((b) => {
            const userVal = inputs[b.index] ?? "";
            const ok = perBlank?.[b.index];
            return (
              <div key={b.index} className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  {`{{${b.index}}}`}
                </span>
                {ok ? (
                  <span className="text-primary">✓ {userVal}</span>
                ) : (
                  <>
                    <span className="text-destructive line-through">
                      {userVal || "(未入力)"}
                    </span>
                    <span className="text-primary">→ {b.answer}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
