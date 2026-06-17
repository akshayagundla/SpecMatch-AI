import { useDropzone } from "react-dropzone";
import { Upload, X, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpecDropzoneProps {
  imageDataUrl: string | null;
  onImage: (dataUrl: string | null) => void;
}

export function SpecDropzone({ imageDataUrl, onImage }: SpecDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".heic"] },
    maxFiles: 1,
    maxSize: 6 * 1024 * 1024,
    onDrop: async (files) => {
      const file = files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => onImage(reader.result as string);
      reader.readAsDataURL(file);
    },
  });

  if (imageDataUrl) {
    return (
      <div className="relative group rounded-md border border-border bg-surface-2 p-2 flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 rounded overflow-hidden border border-border bg-background">
          <img src={imageDataUrl} alt="Attached spec" className="h-full w-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">Spec image attached</p>
          <p className="text-[10px] text-muted-foreground">Will be analyzed by the vision pipeline</p>
        </div>
        <button
          type="button"
          onClick={() => onImage(null)}
          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-surface"
          aria-label="Remove image"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "rounded-md border border-dashed border-border bg-surface-2/40 px-3 py-2.5 cursor-pointer transition-colors",
        "hover:border-violet/60 hover:bg-surface-2/80",
        isDragActive && "border-violet bg-violet/10",
      )}
    >
      <input {...getInputProps()} />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {isDragActive ? (
          <>
            <Upload className="h-3.5 w-3.5 text-violet" />
            <span className="text-foreground">Drop image to attach</span>
          </>
        ) : (
          <>
            <ImageIcon className="h-3.5 w-3.5" />
            <span>Drop a spec screenshot or device photo (optional)</span>
          </>
        )}
      </div>
    </div>
  );
}
