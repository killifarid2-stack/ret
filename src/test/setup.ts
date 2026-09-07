import "@testing-library/jest-dom";

// jsdom 20's File implementation predates the standard .text()/.arrayBuffer()
// methods (landed in jsdom ~22), so tests that build a File via `new File(...)`
// and then call `.text()` on it (e.g. backup.test.ts exercising
// restoreFromBackup, which reads the real File API) fail with
// "file.text is not a function" even though the production code is correct —
// real browsers have supported File.text() for years. Polyfill it here via
// FileReader so the test environment matches actual browser behavior instead
// of weakening the app code to avoid a modern API.
if (typeof File !== "undefined" && !File.prototype.text) {
  File.prototype.text = function (this: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
