import { describe, expect, it } from "vitest";
import { detectVariant, formatBytes, parseModelUrl } from "../src/index.js";

describe("parseModelUrl / detectVariant / formatBytes", () => {
  it("parses resolve URLs", () => {
    expect(parseModelUrl("https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx")).toEqual({
      id: "Xenova/all-MiniLM-L6-v2",
      revision: "main",
      file: "onnx/model_quantized.onnx",
      variant: "q8",
    });
    expect(parseModelUrl("https://huggingface.co/gpt2/resolve/abc123/config.json")?.id).toBe("gpt2");
  });

  it("returns null for other shapes and hosts", () => {
    expect(parseModelUrl("https://example.com/a/b/resolve/main/f")).toBeNull();
    expect(parseModelUrl("https://huggingface.co/a/b/blob/main/f")).toBeNull();
    expect(parseModelUrl("not a url")).toBeNull();
    expect(parseModelUrl("opfs:///x")).toBeNull();
    expect(parseModelUrl("https://huggingface.co/a/b/resolve/main")).toBeNull();
  });

  it("accepts custom hosts", () => {
    expect(parseModelUrl("https://models.example.com/a/b/resolve/main/f.json", ["models.example.com"])?.id).toBe("a/b");
  });

  it("detects variants", () => {
    expect(detectVariant("a/b", "onnx/model.onnx")).toBe("fp32");
    expect(detectVariant("a/b", "onnx/decoder_model_merged_q4.onnx")).toBe("q4");
    expect(detectVariant("a/b", "onnx/model_quantized.onnx_data")).toBe("q8");
    expect(detectVariant("a/b", "config.json")).toBeNull();
    expect(detectVariant("mlc-ai/Qwen2.5-0.5B-Instruct-q0f16-MLC", "x.bin")).toBe("q0f16");
  });

  it("formats bytes in decimal units", () => {
    expect(formatBytes(23685047)).toBe("23.7 MB");
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(1500)).toBe("1.5 KB");
    expect(formatBytes(2_500_000_000)).toBe("2.5 GB");
    expect(formatBytes(null)).toBe("unknown");
    expect(formatBytes(null, "ko")).toBe("알 수 없음");
  });
});
