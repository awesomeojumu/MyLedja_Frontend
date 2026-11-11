import { Platform } from 'react-native';
import { setupPreventIosZoom } from '../preventIosZoom';

describe('setupPreventIosZoom', () => {
  const originalPlatform = Platform.OS;

  interface MockElement {
    id?: string;
    tagName: string;
    textContent?: string;
    attrs: Record<string, string>;
    setAttribute(name: string, value: string): void;
    getAttribute(name: string): string | undefined;
  }

  let elements: MockElement[] = [];

  const createMockElement = (tagName: string): MockElement => {
    const el: MockElement = {
      tagName,
      attrs: {},
      setAttribute(name: string, value: string) {
        this.attrs[name] = value;
      },
      getAttribute(name: string) {
        return this.attrs[name];
      },
    };
    return el;
  };

  const mockDocument = {
    head: {
      appendChild(node: MockElement) {
        elements.push(node);
      },
    },
    querySelector(selector: string) {
      if (selector.includes('viewport')) {
        return elements.find((e) => e.attrs['name'] === 'viewport') ?? null;
      }
      return null;
    },
    getElementById(id: string) {
      return elements.find((e) => e.id === id) ?? null;
    },
    createElement(tagName: string) {
      return createMockElement(tagName);
    },
  };

  beforeEach(() => {
    elements = [];
    (globalThis as unknown as { document: typeof mockDocument }).document = mockDocument;
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform, configurable: true });
    elements = [];
  });

  it('does nothing when not on web', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    setupPreventIosZoom();
    expect(mockDocument.getElementById('prevent-ios-input-zoom')).toBeNull();
  });

  it('configures viewport meta and injects anti-zoom CSS rules on web', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    setupPreventIosZoom();

    const meta = mockDocument.querySelector('meta[name="viewport"]');
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute('content')).toContain('maximum-scale=1');
    expect(meta?.getAttribute('content')).toContain('user-scalable=no');

    const style = mockDocument.getElementById('prevent-ios-input-zoom');
    expect(style).not.toBeNull();
    expect(style?.textContent).toContain('font-size: 16px !important');
    expect(style?.textContent).toContain('touch-action: manipulation');
  });

  it('runs idempotently without duplicating styles', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    setupPreventIosZoom();
    setupPreventIosZoom();

    const styles = elements.filter((e) => e.id === 'prevent-ios-input-zoom');
    expect(styles.length).toBe(1);
  });
});
