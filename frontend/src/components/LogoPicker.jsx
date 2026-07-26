import { Button } from "./ui.jsx";
import i18n from "../i18n/index.js";

function canvasToDataUrl(canvas, quality) {
  return canvas.toDataURL("image/webp", quality);
}

export function readLogoFile(file, onDone, onError, options = {}) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    onError?.(i18n.t("lp.invalidImage"));
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
    onError?.(i18n.t("lp.readError"));
  };
  image.src = objectUrl;
}

export function LogoPicker({
  value,
  onChange,
  onError,
  chooseText,
  changeText,
  removeText,
  previewAlt,
  imageOptions,
}) {
  const choose = chooseText ?? i18n.t("lp.chooseLogo");
  const change = changeText ?? i18n.t("lp.changeLogo");
  const remove = removeText ?? i18n.t("lp.removeLogo");
  const alt = previewAlt ?? i18n.t("lp.logoAlt");
  return (
    <div className="logo-picker">
      <label className="logo-picker-drop">
        <input
          type="file"
          accept="image/*"
          onChange={(event) => readLogoFile(event.target.files?.[0], onChange, onError, imageOptions)}
        />
        <span className="logo-picker-icon">▣</span>
        <span className="logo-picker-text">{value ? change : choose}</span>
        <span className="logo-picker-hint">{i18n.t("lp.pngOrJpg")}</span>
      </label>
      {value && (
        <div className="brand-preview">
          <img src={value} alt={alt} />
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>{remove}</Button>
        </div>
      )}
    </div>
  );
}
