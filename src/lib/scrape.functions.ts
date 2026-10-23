import { createServerFn } from "@tanstack/react-start";

function meta(html: string, key: string): string | null {
  const re1 = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${key}["']`, "i");
  return html.match(re1)?.[1] ?? html.match(re2)?.[1] ?? null;
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function parsePrice(v: unknown): number | null {
  if (v == null) return null;
  let s = String(v).replace(/[^\d.,]/g, "");
  if (!s) return null;
  if (s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

function findLd(obj: any): { name?: string; image?: string; price?: number } | null {
  if (!obj || typeof obj !== "object") return null;
  if (Array.isArray(obj)) { for (const o of obj) { const r = findLd(o); if (r) return r; } return null; }
  if (obj["@graph"]) return findLd(obj["@graph"]);
  const t = obj["@type"];
  if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) {
    const offers = Array.isArray(obj.offers) ? obj.offers[0] : obj.offers;
    const price = parsePrice(offers?.price ?? offers?.lowPrice ?? offers?.priceSpecification?.price);
    const img = Array.isArray(obj.image) ? obj.image[0] : obj.image;
    return { name: obj.name, image: typeof img === "string" ? img : img?.url, price: price ?? undefined };
  }
  return null;
}

export const scrapeProduct = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string }) => {
    const u = new URL(d.url);
    if (!/^https?:$/.test(u.protocol)) throw new Error("URL inválida");
    return { url: u.toString() };
  })
  .handler(async ({ data }) => {
    try {
      const res = await fetch(data.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
          "Accept-Language": "pt-BR,pt;q=0.9",
          Accept: "text/html",
        },
        redirect: "follow",
      });
      const html = (await res.text()).slice(0, 1_500_000);
      let ld: ReturnType<typeof findLd> = null;
      for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
        try { ld = findLd(JSON.parse(m[1])); if (ld) break; } catch { /* ignore */ }
      }
      const name = ld?.name || meta(html, "og:title") || html.match(/<title[^>]*>([^<]*)/i)?.[1] || "";
      let image = ld?.image || meta(html, "og:image") || null;
      if (image) { try { image = new URL(decode(image), data.url).toString(); } catch { image = null; } }
      const price = ld?.price ?? parsePrice(meta(html, "product:price:amount") ?? meta(html, "og:price:amount") ?? meta(html, "price")) ?? 0;
      return { name: decode(name).slice(0, 200), image, price };
    } catch {
      return { name: "", image: null as string | null, price: 0 };
    }
  });
