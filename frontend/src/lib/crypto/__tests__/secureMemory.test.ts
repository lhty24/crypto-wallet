import { describe, it, expect, vi } from "vitest";
import { zeroBuffer, zeroBuffers, withSecureCleanup } from "../secureMemory";

describe("secureMemory", () => {
  describe("zeroBuffer", () => {
    it("zeros out a buffer completely", () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

      zeroBuffer(buffer);

      expect(buffer.every((byte) => byte === 0)).toBe(true);
    });

    it("handles empty buffer", () => {
      const buffer = new Uint8Array(0);

      expect(() => zeroBuffer(buffer)).not.toThrow();
      expect(buffer.length).toBe(0);
    });

    it("handles large buffer", () => {
      const buffer = new Uint8Array(1000);
      buffer.fill(0xff);

      zeroBuffer(buffer);

      expect(buffer.every((byte) => byte === 0)).toBe(true);
    });

    it("modifies the original buffer in place", () => {
      const buffer = new Uint8Array([42, 43, 44]);
      const originalRef = buffer;

      zeroBuffer(buffer);

      expect(originalRef).toBe(buffer);
      expect(originalRef[0]).toBe(0);
    });
  });

  describe("zeroBuffers", () => {
    it("zeros out multiple buffers", () => {
      const buffer1 = new Uint8Array([1, 2, 3]);
      const buffer2 = new Uint8Array([4, 5, 6]);
      const buffer3 = new Uint8Array([7, 8, 9]);

      zeroBuffers(buffer1, buffer2, buffer3);

      expect(buffer1.every((byte) => byte === 0)).toBe(true);
      expect(buffer2.every((byte) => byte === 0)).toBe(true);
      expect(buffer3.every((byte) => byte === 0)).toBe(true);
    });

    it("handles single buffer", () => {
      const buffer = new Uint8Array([1, 2, 3]);

      zeroBuffers(buffer);

      expect(buffer.every((byte) => byte === 0)).toBe(true);
    });

    it("handles no buffers", () => {
      expect(() => zeroBuffers()).not.toThrow();
    });

    it("handles mixed size buffers", () => {
      const small = new Uint8Array([1]);
      const medium = new Uint8Array([1, 2, 3, 4, 5]);
      const large = new Uint8Array(100);
      large.fill(0xff);

      zeroBuffers(small, medium, large);

      expect(small.every((byte) => byte === 0)).toBe(true);
      expect(medium.every((byte) => byte === 0)).toBe(true);
      expect(large.every((byte) => byte === 0)).toBe(true);
    });
  });

  describe("withSecureCleanup", () => {
    it("executes function and returns result", async () => {
      const buffer = new Uint8Array([1, 2, 3]);

      const result = await withSecureCleanup(buffer, (buf) => {
        return buf.reduce((a, b) => a + b, 0); // Sum = 6
      });

      expect(result).toBe(6);
    });

    it("zeros buffer after function completes", async () => {
      const buffer = new Uint8Array([1, 2, 3]);

      await withSecureCleanup(buffer, () => {
        // Buffer should still have data during execution
        return "done";
      });

      expect(buffer.every((byte) => byte === 0)).toBe(true);
    });

    it("zeros buffer even if function throws", async () => {
      const buffer = new Uint8Array([1, 2, 3]);

      await expect(
        withSecureCleanup(buffer, () => {
          throw new Error("test error");
        })
      ).rejects.toThrow("test error");

      // Buffer should still be zeroed
      expect(buffer.every((byte) => byte === 0)).toBe(true);
    });

    it("works with async functions", async () => {
      const buffer = new Uint8Array([10, 20, 30]);

      const result = await withSecureCleanup(buffer, async (buf) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return buf[0] + buf[1] + buf[2];
      });

      expect(result).toBe(60);
      expect(buffer.every((byte) => byte === 0)).toBe(true);
    });

    it("zeros buffer after async function throws", async () => {
      const buffer = new Uint8Array([1, 2, 3]);

      await expect(
        withSecureCleanup(buffer, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          throw new Error("async error");
        })
      ).rejects.toThrow("async error");

      expect(buffer.every((byte) => byte === 0)).toBe(true);
    });

    it("preserves function return type", async () => {
      const buffer = new Uint8Array([1]);

      const stringResult = await withSecureCleanup(buffer, () => "hello");
      expect(typeof stringResult).toBe("string");

      const buffer2 = new Uint8Array([1]);
      const objectResult = await withSecureCleanup(buffer2, () => ({
        foo: "bar",
      }));
      expect(objectResult).toEqual({ foo: "bar" });

      const buffer3 = new Uint8Array([1]);
      const arrayResult = await withSecureCleanup(buffer3, () => [1, 2, 3]);
      expect(arrayResult).toEqual([1, 2, 3]);
    });
  });

  describe("real-world usage patterns", () => {
    it("can be used to clean up private keys after signing", async () => {
      // Simulate a private key
      const privateKey = new Uint8Array(32);
      crypto.getRandomValues(privateKey);

      // Simulate signing operation
      const signature = await withSecureCleanup(privateKey, async (key) => {
        // In real code, this would sign something
        return `signed-with-${key[0]}`;
      });

      expect(signature).toContain("signed-with");
      expect(privateKey.every((byte) => byte === 0)).toBe(true);
    });

    it("can clean up seed after address derivation", () => {
      const seed = new Uint8Array(64);
      crypto.getRandomValues(seed);
      const seedCopy = new Uint8Array(seed); // Keep copy to verify it was non-zero

      zeroBuffer(seed);

      expect(seed.every((byte) => byte === 0)).toBe(true);
      expect(seedCopy.some((byte) => byte !== 0)).toBe(true); // Original was non-zero
    });
  });
});
