import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_DAILY_GOAL,
  DEFAULT_EXAM_DATE,
  getDailyGoal,
  getExamDateKey,
  setDailyGoal,
  setExamDateKey,
} from "@/lib/user-settings";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const [examDate, setExamDate] = useState<string>(() => getExamDateKey());
  const [goal, setGoal] = useState<string>(() => String(getDailyGoal()));

  const onSave = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate)) {
      toast.error("試験日の形式が正しくありません");
      return;
    }
    const n = parseInt(goal, 10);
    if (!Number.isFinite(n) || n <= 0 || n > 9999) {
      toast.error("目標問題数は1〜9999の整数で入力してください");
      return;
    }
    setExamDateKey(examDate);
    setDailyGoal(n);
    toast.success("設定を保存しました");
    navigate({ to: "/" });
  };

  const onReset = () => {
    setExamDate(DEFAULT_EXAM_DATE);
    setGoal(String(DEFAULT_DAILY_GOAL));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b bg-card px-5 py-4">
        <Link to="/" className="text-sm text-muted-foreground">
          ← 戻る
        </Link>
        <h1 className="text-lg font-semibold">設定</h1>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-5 py-8">
        <section className="space-y-2 rounded-2xl border bg-card p-5 shadow-sm">
          <Label htmlFor="exam-date" className="text-sm font-medium">
            試験日
          </Label>
          <Input
            id="exam-date"
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            ホーム画面のカウントダウンに使われます(日本時間基準)
          </p>
        </section>

        <section className="space-y-2 rounded-2xl border bg-card p-5 shadow-sm">
          <Label htmlFor="daily-goal" className="text-sm font-medium">
            1日の目標問題数
          </Label>
          <Input
            id="daily-goal"
            type="number"
            min={1}
            max={9999}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            「本日の学習」の進捗バーに使われます
          </p>
        </section>

        <div className="flex gap-3">
          <Button onClick={onSave} className="flex-1">
            保存
          </Button>
          <Button variant="outline" onClick={onReset}>
            初期値に戻す
          </Button>
        </div>
      </main>
    </div>
  );
}
