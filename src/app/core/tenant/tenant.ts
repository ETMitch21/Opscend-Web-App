export function getShopSlugFromHost(hostname: string): string | null {
    const parts = hostname.split(".");
    if (parts.length < 3) return null;
    return parts[0] || null;
}