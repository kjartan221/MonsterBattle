import { publicKeyToColor, publicKeyToGradient, colorToRGBA } from '../src/utils/publicKeyToColor';

describe('publicKeyToColor', () => {
  it('should generate a consistent color from the same public key', () => {
    const publicKey = '0317aa2014cc6f42b31c54fa0bcd3d8904e40e5c5ea35d0ecee7c12d326d756d09';
    const color1 = publicKeyToColor(publicKey);
    const color2 = publicKeyToColor(publicKey);

    expect(color1).toBe(color2);
    expect(color1).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('should generate different colors for different public keys', () => {
    const publicKey1 = '0317aa2014cc6f42b31c54fa0bcd3d8904e40e5c5ea35d0ecee7c12d326d756d09';
    const publicKey2 = '02b5c4e5d8a7f9c3b1e6d2a8f4c7b9e3d5a1f8c6b4e2d9a7f5c3b1e8d6a4f2c9b7';

    const color1 = publicKeyToColor(publicKey1);
    const color2 = publicKeyToColor(publicKey2);

    expect(color1).not.toBe(color2);
  });

  it('should generate a valid hex color', () => {
    const publicKey = '0317aa2014cc6f42b31c54fa0bcd3d8904e40e5c5ea35d0ecee7c12d326d756d09';
    const color = publicKeyToColor(publicKey);

    // Check hex format
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);

    // Check it's not black
    expect(color).not.toBe('#000000');
  });
});

describe('publicKeyToGradient', () => {
  it('should generate two distinct colors for a gradient', () => {
    const publicKey = '0317aa2014cc6f42b31c54fa0bcd3d8904e40e5c5ea35d0ecee7c12d326d756d09';
    const gradient = publicKeyToGradient(publicKey);

    expect(gradient).toHaveProperty('color1');
    expect(gradient).toHaveProperty('color2');
    expect(gradient.color1).toMatch(/^#[0-9a-f]{6}$/i);
    expect(gradient.color2).toMatch(/^#[0-9a-f]{6}$/i);
    expect(gradient.color1).not.toBe(gradient.color2);
  });

  it('should be deterministic (same key = same gradient)', () => {
    const publicKey = '0317aa2014cc6f42b31c54fa0bcd3d8904e40e5c5ea35d0ecee7c12d326d756d09';
    const gradient1 = publicKeyToGradient(publicKey);
    const gradient2 = publicKeyToGradient(publicKey);

    expect(gradient1.color1).toBe(gradient2.color1);
    expect(gradient1.color2).toBe(gradient2.color2);
  });
});

describe('colorToRGBA', () => {
  it('should convert hex color to RGBA with opacity', () => {
    const hex = '#ff5733';
    const rgba = colorToRGBA(hex, 0.5);

    expect(rgba).toBe('rgba(255, 87, 51, 0.5)');
  });

  it('should handle full opacity', () => {
    const hex = '#00ff00';
    const rgba = colorToRGBA(hex, 1);

    expect(rgba).toBe('rgba(0, 255, 0, 1)');
  });

  it('should handle zero opacity', () => {
    const hex = '#0000ff';
    const rgba = colorToRGBA(hex, 0);

    expect(rgba).toBe('rgba(0, 0, 255, 0)');
  });
});
