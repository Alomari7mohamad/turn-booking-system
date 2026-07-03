import { Button } from "./ui.jsx";

function canvasToDataUrl(canvas, quality) {
  return canvas.toDataURL("image/webp", quality);
}

export function readLogoFile(file, onDone, onError, options = {}) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    onError?.("اختر ملف صورة صالح");
    return;
  }

  const maxSize = options.maxSize || 420;
  const minSize = options.minSize || 220;
  const maxBytes = options.maxBytes || 260 * 1024;
  let quality = options.quality || 0.82;

  const image = new Image();
  const objectUrl = URL.createObjectURL(file);

  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    let targetSize = maxSize;
    let dataUrl = "";

    for (let attempt = 0; attempt < 14; attempt += 1) {
      const scale = Math.min(1, targetSize / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);

      dataUrl = canvasToDataUrl(canvas, quality);
      if (dataUrl.length <= maxBytes) break;

      quality = Math.max(0.45, quality - 0.07);
      targetSize = Math.max(minSize, Math.round(targetSize * 0.82));

      if (targetSize <= minSize && quality <= 0.45) break;
    }

    onDone(dataUrl);
  };

  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    onError?.("تعذر قراءة الصورة");
  };
  image.src = objectUrl;
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
