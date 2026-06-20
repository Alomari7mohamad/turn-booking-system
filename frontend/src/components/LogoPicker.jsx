import { Button } from "./ui.jsx";

export function readLogoFile(file, onDone, onError) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    onError?.("اختر ملف صورة صالح");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const size = 420;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, size, size);

      const scale = Math.min(size / image.width, size / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      const x = (size - width) / 2;
      const y = (size - height) / 2;
      ctx.drawImage(image, x, y, width, height);

      onDone(canvas.toDataURL("image/webp", 0.82));
    };
    image.onerror = () => onError?.("تعذر قراءة صورة الشعار");
    image.src = reader.result;
  };
  reader.onerror = () => onError?.("تعذر قراءة صورة الشعار");
  reader.readAsDataURL(file);
}

export function LogoPicker({ value, onChange, onError }) {
  return (
    <div className="logo-picker">
      <label className="logo-picker-drop">
        <input
          type="file"
          accept="image/*"
          onChange={(event) => readLogoFile(event.target.files?.[0], onChange, onError)}
        />
        <span className="logo-picker-icon">🖼</span>
        <span className="logo-picker-text">{value ? "تغيير الشعار" : "اختيار شعار"}</span>
        <span className="logo-picker-hint">PNG أو JPG</span>
      </label>
      {value && (
        <div className="brand-preview">
          <img src={value} alt="شعار المحل" />
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>إزالة الشعار</Button>
        </div>
      )}
    </div>
  );
}
