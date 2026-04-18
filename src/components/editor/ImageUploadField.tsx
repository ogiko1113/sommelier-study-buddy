import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const BUCKET = "question-images";
const MAX_FINAL_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface ImageUploadFieldProps {
  value: string | null;
  onChange: (url: string | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
}

/** Extract storage object path from a public URL. Returns null if not a known bucket URL. */
function pathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.substring(idx + marker.length);
}

export function ImageUploadField({
  value,
  onChange,
  onUploadingChange,
}: ImageUploadFieldProps) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [meta, setMeta] = useState<{ name: string; size: number } | null>(null);

  const setUploadingState = (v: boolean) => {
    setUploading(v);
    onUploadingChange?.(v);
  };

  const processFile = async (file: File) => {
    if (!user) {
      toast.error("ログインが必要です");
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("対応形式: JPEG / PNG / WebP");
      return;
    }
    setUploadingState(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 5,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.85,
      });
      if (compressed.size > MAX_FINAL_BYTES) {
        toast.error("画像サイズが大きすぎます(5MB以下に圧縮してください)");
        setUploadingState(false);
        return;
      }
      const oldUrl = value;
      const fileName = `${crypto.randomUUID()}.jpg`;
      const path = `${user.id}/${fileName}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, compressed, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });
      if (upErr) {
        console.error("upload error", upErr);
        toast.error(`アップロードに失敗しました: ${upErr.message}`);
        setUploadingState(false);
        return;
      }
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      onChange(publicUrl);
      setMeta({ name: file.name, size: compressed.size });

      // Delete old image (best-effort)
      if (oldUrl) {
        const oldPath = pathFromPublicUrl(oldUrl);
        if (oldPath) {
          const { error: delErr } = await supabase.storage.from(BUCKET).remove([oldPath]);
          if (delErr) console.warn("old image delete failed", delErr);
        }
      }
      toast.success("画像をアップロードしました");
    } catch (e) {
      console.error("compress/upload error", e);
      toast.error(`画像処理に失敗しました: ${(e as Error).message}`);
    } finally {
      setUploadingState(false);
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void processFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void processFile(f);
  };

  const onDelete = async () => {
    if (!value) return;
    const oldPath = pathFromPublicUrl(value);
    if (oldPath) {
      const { error: delErr } = await supabase.storage.from(BUCKET).remove([oldPath]);
      if (delErr) console.warn("image delete failed", delErr);
    }
    onChange(null);
    setMeta(null);
    setConfirmDelete(false);
    toast.success("画像を削除しました");
  };

  return (
    <div className="space-y-2">
      <Label className="text-base">画像</Label>
      {value ? (
        <div className="space-y-2 rounded-lg border border-input bg-card p-3">
          <img
            src={value}
            alt="問題画像"
            className="mx-auto max-h-60 w-auto rounded-md object-contain"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
            <span className="truncate">
              {meta ? `${meta.name} · ${(meta.size / 1024).toFixed(0)} KB` : "アップロード済み"}
            </span>
          </div>
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2">
              <span className="text-xs text-destructive">画像を削除します。よろしいですか?</span>
              <div className="ml-auto flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDelete(false)}
                  disabled={uploading}
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={onDelete}
                  disabled={uploading}
                >
                  確認
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "アップロード中..." : "画像を差し替え"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                disabled={uploading}
              >
                画像を削除
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          aria-label="画像を選択またはドラッグ&ドロップ"
          className={`flex min-h-[120px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors ${
            dragOver
              ? "border-primary bg-primary/5 text-foreground"
              : "border-input bg-card text-muted-foreground hover:bg-accent/40"
          } ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          {uploading
            ? "アップロード中..."
            : "画像をドラッグ&ドロップまたはクリックして選択"}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onPickFile}
        className="hidden"
      />
    </div>
  );
}
