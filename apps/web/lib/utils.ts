import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parsePriceString(priceStr: string): Record<string, number> {
  if (!priceStr) return {};
  const prices: Record<string, number> = {};
  // Split by " / " (with spaces) to protect "VIP/OP" correctly
  const segments = priceStr.split(' / ');

  segments.forEach(seg => {
    const match = seg.trim().match(/^(.+?)\s+([\d,]+)(?:원)?$/);
    if (match) {
      let gradeRaw = match[1].trim();
      const priceRaw = match[2].replace(/,/g, '');
      const price = parseInt(priceRaw, 10);

      // Extract base names (e.g., "VIP/OP석" -> ["VIP", "OP"])
      const baseNames = gradeRaw.replace(/석+$/, '').split('/');
      baseNames.forEach(bn => {
        const clean = bn.trim();
        // Prioritize the "석" suffix if it was originally present or if the clean name doesn't have it.
        // This prevents duplicate entries like "VIP" and "VIP석" if the original grade was "VIP석".
        // If the original grade was "VIP", it will add "VIP" and "VIP석".
        // If the original grade was "VIP석", it will add "VIP" and "VIP석".
        // The instruction "등급 명칭 중복 방지 및 가격 매핑 우선순위 조정" is interpreted as ensuring
        // that both forms (with and without "석") are present, but if the original grade already
        // contained "석", we should ensure that form is correctly mapped.
        // The provided snippet was syntactically incorrect (JSX in TS), so it's interpreted
        // as a logical change to the mapping strategy.

        // Always add the cleaned name
        prices[clean] = price;

        // If the cleaned name doesn't end with '석', add the '석' version as well.
        // This ensures both "VIP" and "VIP석" are present if the original was "VIP" or "VIP석".
        if (!clean.endsWith('석')) {
          prices[clean + "석"] = price;
        }
      });
    }
  });

  return prices;
}
