import { Button } from "./ui.jsx";

export function readLogoFile(file, onDone, onError, options = {}) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    onError?.("اختر ملف صورة صالح");
    return;
  }

  const maxSize = options.maxSize || 420;
  const quality = options.quality || 0.86;

  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);

      onDone(canvas.toDataURL("image/webp", quality));
    };
    image.onerror = () => onError?.("تعذر قراءة الصورة");
    image.src = reader.result;
  };
  reader.onerror = () => onError?.("تعذر قراءة الصورة");
  reader.readAsDataURL(file);
}

export function LogoPicker({
  value,
  onChange,
  onError,
  chooseText = "اختار شعار",
  changeText = "تغيير الشعار",
  removeText = "إزالة الشعار",
  previewAlt = "شعار المحل",
  imageOptions,
}) {
  return (
    <div className="logo-picker">
      <label className="logo-picker-drop">
        <input
          type="file"
          accept="image/*"
          onChange={(event) => readLogoFile(event.target.files?.[0], onChange, onError, imageOptions)}
        />
        <span className="logo-picker-icon">▣</span>
        <span className="logo-picker-text">{value ? changeText : chooseText}</span>
        <span className="logo-picker-hint">PNG أو JPG</span>
      </label>
      {value && (
        <div className="brand-preview">
          <img src={value} alt={previewAlt} />
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>{removeText}</Button>
        </div>
      )}
    </div>
  );
}
