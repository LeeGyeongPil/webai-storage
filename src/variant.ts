const DTYPE_SUFFIX: Record<string, string> = {
  quantized: "q8",
  q4f16: "q4f16",
  q4: "q4",
  fp16: "fp16",
  int8: "int8",
  uint8: "uint8",
  bnb4: "bnb4",
  q2: "q2",
  q1: "q1",
};

const ONNX = /^(.+?)(?:_(quantized|q4f16|q4|fp16|int8|uint8|bnb4|q2|q1))?\.onnx(?:_data(?:_\d+)?)?$/;
const MLC = /-(q\d+f\d+(?:_\d+)?|q\d+(?:_\d+)?)-MLC$/;

/**
 * Work out the quantisation variant of one file.
 * MLC model ids carry it in the name ("...-q4f16_1-MLC"); Transformers.js ONNX files
 * carry it as a suffix ("model_quantized.onnx" -> q8, no suffix -> fp32).
 */
export function detectVariant(modelId: string, file: string): string | null {
  const mlc = MLC.exec(modelId);
  if (mlc) return mlc[1] ?? null;
  const base = file.split("/").pop() ?? file;
  const onnx = ONNX.exec(base);
  if (!onnx) return null;
  const suffix = onnx[2];
  return suffix ? (DTYPE_SUFFIX[suffix] ?? suffix) : "fp32";
}
