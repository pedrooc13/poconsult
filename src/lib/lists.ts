export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const KEY = "carrinho:lists";
export type SavedList = { id: string; name: string };

export function getSaved(): SavedList[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function remember(l: SavedList) {
  const all = getSaved().filter((x) => x.id !== l.id);
  localStorage.setItem(KEY, JSON.stringify([l, ...all].slice(0, 30)));
}
export function forget(id: string) {
  localStorage.setItem(KEY, JSON.stringify(getSaved().filter((x) => x.id !== id)));
}
