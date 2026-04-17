import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/" });
    }
  }, [loading, session, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await signIn(email, password);
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Wine Master</h1>
          <p className="mt-2 text-sm text-muted-foreground">JSAワインエキスパート対策</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-5 rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-base">
              メールアドレス
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-base">
              パスワード
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 text-base"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={submitting}
            className="h-12 w-full text-base font-medium"
          >
            {submitting ? "ログイン中..." : "ログイン"}
          </Button>
        </form>
      </div>
    </div>
  );
}
