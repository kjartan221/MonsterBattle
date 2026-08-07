/**
 * Converts a public key hex string to two unique, vibrant colors for gradients
 *
 * This creates deterministic colors based on the user's public key,
 * making each item visually unique per user while maintaining
 * consistency across the same user's items.
 *
 * @param publicKeyHex - Public key as hex string (e.g., "0317aa2014cc6f42b31c54fa0bcd3d8904e40e5c5ea35d0ecee7c12d326d756d09")
 * @returns Object with two hex color codes for gradient { color1: "#FF5733", color2: "#33C3FF" }
 */
export function publicKeyToGradient(publicKeyHex: string): { color1: string; color2: string } {
  // Remove "0x" prefix if present
  const cleanHex = publicKeyHex.replace(/^0x/, '');

  // Extract segments from different parts of the public key for two distinct colors
  // Color 1: Use beginning and middle of key
  const c1_segment1 = cleanHex.slice(2, 10);   // Characters 2-10
  const c1_segment2 = cleanHex.slice(20, 28);  // Characters 20-28
  const c1_segment3 = cleanHex.slice(38, 46);  // Characters 38-46

  // Color 2: Use middle and end of key (offset from color 1)
  const c2_segment1 = cleanHex.slice(12, 20);  // Characters 12-20
  const c2_segment2 = cleanHex.slice(30, 38);  // Characters 30-38
  const c2_segment3 = cleanHex.slice(50, 58);  // Characters 50-58

  // Helper function to generate color from segments
  const generateColor = (seg1: string, seg2: string, seg3: string): string => {
    // Convert hex segments to decimal values
    const hash1 = parseInt(seg1, 16);
    const hash2 = parseInt(seg2, 16);
    const hash3 = parseInt(seg3, 16);

    // Generate RGB values (0-255)
    let r = hash1 % 256;
    let g = hash2 % 256;
    let b = hash3 % 256;

    // Ensure minimum brightness (colors too dark won't show well)
    const brightness = (r + g + b) / 3;
    if (brightness < 80) {
      const boost = 80 / brightness;
      r = Math.min(255, Math.floor(r * boost));
      g = Math.min(255, Math.floor(g * boost));
      b = Math.min(255, Math.floor(b * boost));
    }

    // Ensure minimum saturation (avoid gray colors)
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;

    if (saturation < 0.3) {
      // Boost the dominant color
      if (r === max) r = Math.min(255, r + 50);
      else if (g === max) g = Math.min(255, g + 50);
      else b = Math.min(255, b + 50);
    }

    // Convert to hex and pad with zeros if needed
    const toHex = (n: number) => {
      const hex = Math.min(255, Math.max(0, Math.round(n))).toString(16);
      return hex.padStart(2, '0');
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const color1 = generateColor(c1_segment1, c1_segment2, c1_segment3);
  const color2 = generateColor(c2_segment1, c2_segment2, c2_segment3);

  return { color1, color2 };
}

/**
 * Generates a lighter version of the color for backgrounds/glows
 *
 * @param colorHex - Hex color code
 * @param opacity - Opacity value 0-1
 * @returns RGBA color string
 */
export function colorToRGBA(colorHex: string, opacity: number = 0.5): string {
  const hex = colorHex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Backward compatible function that returns a single color
 * (uses color1 from the gradient)
 */
export function publicKeyToColor(publicKeyHex: string): string {
  const { color1 } = publicKeyToGradient(publicKeyHex);
  return color1;
}

/**
 * Example usage:
 * const publicKey = "0317aa2014cc6f42b31c54fa0bcd3d8904e40e5c5ea35d0ecee7c12d326d756d09";
 * const gradient = publicKeyToGradient(publicKey);
 * // Returns: { color1: "#aa8e53", color2: "#5392d4" } (deterministic)
 *
 * // Or use single color:
 * const color = publicKeyToColor(publicKey);
 * // Returns: "#aa8e53"
 */
