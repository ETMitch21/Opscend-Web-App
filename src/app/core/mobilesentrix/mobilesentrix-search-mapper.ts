import {
  MobileSentrixSearchItemApi,
  MobileSentrixSearchResult,
} from './mobilesentrix-model';

function parseMoneyToCents(value: string | null | undefined): number | null {
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;

  return Math.round(parsed * 100);
}

function parseTags(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];

  return value
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export function mapMobileSentrixItem(
  item: MobileSentrixSearchItemApi
): MobileSentrixSearchResult {
  return {
    // ✅ API contract
    id: item.product_id,

    // ✅ direct mappings
    title: item.title,
    link: item.link?.trim() || null,

    // ✅ SKU PRIORITY (your rule)
    sku:
      item.new_sku?.trim() ||
      item.product_code?.trim() ||
      null,

    // ✅ cost (NOT selling price)
    costCents: parseMoneyToCents(item.price),

    // ✅ stock logic (string → boolean)
    inStock: item.quantity === '1',

    // ✅ media
    imageUrl: item.image_link?.trim() || null,

    // ✅ metadata
    tags: parseTags(item.tags),
    category: item.front_position?.trim() || null,

    supplier: 'mobilesentrix',
  };
}

export function mapMobileSentrixItems(
  items: MobileSentrixSearchItemApi[]
): MobileSentrixSearchResult[] {
  return items.map(mapMobileSentrixItem);
}