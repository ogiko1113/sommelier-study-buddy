import { useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface FlagButtonProps {
  questionId: string;
  initialFlagged?: boolean;
  initialNote?: string | null;
}

/**
 * 🚩 flag toggle for a single question. Never advances/skips the quiz/SRS
 * question — purely a side-effect on the question row.
 *
 * - When toggling ON: opens a dialog so the user can optionally add a memo.
 * - When toggling OFF: immediately clears `needs_review` and `review_note`.
 */
export function FlagButton({ questionId, initialFlagged, initialNote }: FlagButtonProps) {
  const [flagged, setFlagged] = useState<boolean>(initialFlagged ?? false);
  const [note, setNote] = useState<string>(initialNote ?? "");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reset local state when the question changes (parent reuses the component across questions)
  useEffect(() => {
    setFlagged(initialFlagged ?? false);
    setNote(initialNote ?? "");
  }, [questionId, initialFlagged, initialNote]);

  const onClick = async () => {
    if (flagged) {
      // Clear immediately
      setFlagged(false);
      setNote("");
      const { error } = await (supabase as any)
        .from("questions")
        .update({ needs_review: false, review_note: null })
        .eq("id", questionId);
      if (error) {
        console.error("flag clear error", error);
        toast.error("フラグの解除に失敗しました");
        setFlagged(true);
      } else {
        toast.success("フラグを解除しました");
      }
    } else {
      // Open dialog for optional note
      setDialogOpen(true);
    }
  };

  const onConfirmFlag = async () => {
    setSaving(true);
    const trimmed = note.trim();
    const { error } = await (supabase as any)
      .from("questions")
      .update({
        needs_review: true,
        review_note: trimmed.length > 0 ? trimmed : null,
      })
      .eq("id", questionId);
    setSaving(false);
    if (error) {
      console.error("flag set error", error);
      toast.error("フラグの設定に失敗しました");
      return;
    }
    setFlagged(true);
    setDialogOpen(false);
    toast.success("フラグを設定しました");
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label={flagged ? "フラグを解除" : "フラグを設定"}
        aria-pressed={flagged}
        className="p-2"
      >
        <Flag
          className={`h-6 w-6 ${
            flagged ? "fill-destructive text-destructive" : "text-muted-foreground"
          }`}
        />
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>この問題にフラグを立てる</DialogTitle>
            <DialogDescription>
              要復習として記録します。メモは任意です(エディタから後で編集できます)。
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="メモ(任意)"
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              キャンセル
            </Button>
            <Button onClick={onConfirmFlag} disabled={saving}>
              {saving ? "保存中..." : "フラグを立てる"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
