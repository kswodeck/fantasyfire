// Adds @testing-library/jest-dom matchers (toBeInTheDocument, etc.) to Vitest's
// `expect`. Harmless in the default node environment; needed by component tests
// that opt into jsdom.
import '@testing-library/jest-dom/vitest';
