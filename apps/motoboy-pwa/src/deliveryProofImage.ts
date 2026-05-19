export type ProofUploadPayload = {
  fileName: string;
  mimeType: string;
  contentBase64: string;
};

const MAX_PROOF_IMAGE_SIDE = 1600;
export const MAX_PROOF_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Redimensiona mantendo proporcao para reduzir foto grande antes do upload. */
export function scaledImageSize(width: number, height: number, maxSide = MAX_PROOF_IMAGE_SIDE) {
  const largestSide = Math.max(width, height);
  if (largestSide <= maxSide) return { width, height };

  const ratio = maxSide / largestSide;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/** Define a escada de qualidade usada para tentar comprimir a foto sem estourar 4 MB. */
export function proofCompressionQualities(initial = 82, minimum = 45, step = 8) {
  const qualities = [initial];
  let quality = initial;
  while (quality > minimum) {
    quality -= step;
    qualities.push(quality);
  }
  return qualities.map((value) => value / 100);
}

/** Garante o mesmo limite aceito pela API antes de gastar rede enviando a foto. */
export function assertProofUploadSize(sizeBytes: number) {
  if (sizeBytes < 1 || sizeBytes > MAX_PROOF_UPLOAD_BYTES) {
    throw new Error("A foto precisa ficar entre 1 byte e 4 MB apos compressao.");
  }
}

/** Prepara o comprovante opcional para upload, comprimindo imagem quando o navegador permitir. */
export async function prepareProofUpload(file: File, fallbackFileName: string): Promise<ProofUploadPayload> {
  if (!file.type.startsWith("image/")) {
    assertProofUploadSize(file.size);
    return {
      fileName: file.name || fallbackFileName,
      mimeType: file.type || "application/octet-stream",
      contentBase64: await fileToBase64(file),
    };
  }

  try {
    const compressed = await compressProofImage(file);
    assertProofUploadSize(compressed.size);
    return {
      fileName: withJpegExtension(file.name || fallbackFileName),
      mimeType: "image/jpeg",
      contentBase64: await blobToBase64(compressed),
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("4 MB")) throw error;
    assertProofUploadSize(file.size);
    return {
      fileName: file.name || fallbackFileName,
      mimeType: file.type || "image/jpeg",
      contentBase64: await fileToBase64(file),
    };
  }
}

/** Comprime a imagem em canvas tentando qualidades menores ate caber no limite operacional. */
async function compressProofImage(file: File): Promise<Blob> {
  const image = await loadImage(file);
  const { width, height } = scaledImageSize(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponivel.");

  context.drawImage(image, 0, 0, width, height);
  URL.revokeObjectURL(image.src);

  let lastBlob: Blob | null = null;
  for (const quality of proofCompressionQualities()) {
    const blob = await canvasToJpegBlob(canvas, quality);
    lastBlob = blob;
    if (blob.size <= MAX_PROOF_UPLOAD_BYTES) return blob;
  }

  if (lastBlob) assertProofUploadSize(lastBlob.size);
  throw new Error("Nao foi possivel comprimir a foto.");
}

/** Converte o canvas para JPEG em Promise para manter o fluxo de upload linear. */
function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Nao foi possivel comprimir a foto."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

/** Carrega o arquivo local como imagem do navegador para permitir redimensionamento. */
function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      URL.revokeObjectURL(image.src);
      reject(new Error("Nao foi possivel carregar a foto."));
    };
    image.src = URL.createObjectURL(file);
  });
}

/** Le arquivo de imagem sem compressao quando o fallback precisar enviar o original. */
function fileToBase64(file: File) {
  return blobToBase64(file);
}

/** Remove o prefixo data URL e entrega somente o base64 que a API espera. */
function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.includes(",") ? value.split(",")[1] : value);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler foto."));
    reader.readAsDataURL(blob);
  });
}

/** Padroniza o nome do arquivo comprimido como JPEG. */
function withJpegExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") + ".jpg";
}
