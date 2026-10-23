import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { scrapeProduct } from "@/lib/scrape.functions";
import { forget, brl, remember } from "@/lib/lists";

export const Route = createFileRoute("/l/$id")({
  head: () => ({
    meta: [
      { title: "Lista de compras compartilhada — Carrinho" },
      { name: "description", content: "Veja os produtos desta lista de compras e o total somado." },
      { property: "og:title", content: "Lista de compras compartilhada — Carrinho" },
      { property: "og:description", content: "Veja os produtos desta lista de compras e o total somado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ListPage,
});

type Item = {
  id: string; url: string; name: string; image: string | null; price: number; quantity: number;
};

function ListPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [listName, setListName] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("items").select("*").eq("list_id", id).order("created_at");
    setItems((data as Item[]) ?? []);
  }, [id]);

  useEffect(() => {
    supabase.from("lists").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (!data) return setMissing(true);
      setListName(data.name);
      remember({ id: data.id, name: data.name });
    });
    load();
    const ch = supabase
      .channel(`items-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "items", filter: `list_id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  const total = items.reduce((s, i) => s + Number(i.price) * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    let link = url.trim();
    if (!link) return;
    if (!/^https?:\/\//i.test(link)) link = "https://" + link;
    setAdding(true);
    const info = await scrapeProduct({ data: { url: link } }).catch(() => ({ name: "", image: null, price: 0 }));
    const { data } = await supabase.from("items").insert({
      list_id: id, url: link, name: info.name || new URL(link).hostname, image: info.image, price: info.price,
    }).select().single();
    setAdding(false);
    setUrl("");
    await load();
    if (data && (!info.price || !info.name)) setEditing(data as Item);
  }

  async function update(item: Item, patch: Partial<Item>) {
    setItems((p) => p.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
    await supabase.from("items").update(patch).eq("id", item.id);
  }
  async function remove(item: Item) {
    setItems((p) => p.filter((i) => i.id !== item.id));
    await supabase.from("items").delete().eq("id", item.id);
  }

  async function share() {
    const link = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: listName ?? "Lista", text: `Minha lista: ${listName}`, url: link }); return; } catch { /* fallthrough */ }
    }
    await navigator.clipboard.writeText(link);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function deleteList() {
    await supabase.from("lists").delete().eq("id", id);
    forget(id);
    nav({ to: "/" });
  }

  if (missing) {
    return (
      <main className="mx-auto max-w-md px-5 pt-20 text-center">
        <h1 className="text-2xl font-bold">Lista não encontrada</h1>
        <Link to="/" className="mt-4 inline-block text-primary">Voltar</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-40 pt-6">
      <header className="flex items-center justify-between">
        <Link to="/" className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">← Listas</Link>
        <div className="flex items-center gap-2">
          <button onClick={() => setConfirming(true)} className="rounded-full px-3 py-2 text-sm font-semibold text-destructive" aria-label="Excluir lista">
            Excluir
          </button>
          <button onClick={share} className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground">
            {copied ? "Link copiado!" : "Compartilhar"}
          </button>
        </div>
      </header>
      <h1 className="mt-5 text-4xl font-extrabold tracking-tight">{listName ?? "…"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{count} {count === 1 ? "produto" : "produtos"}</p>

      <form onSubmit={add} className="mt-5 flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Cole o link do produto"
          inputMode="url"
          className="h-14 min-w-0 flex-1 rounded-2xl border border-input bg-card px-4 text-base outline-none focus:ring-2 focus:ring-ring"
        />
        <button disabled={adding} className="h-14 rounded-2xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-60">
          {adding ? "…" : "Adicionar"}
        </button>
      </form>

      <ul className="mt-6 flex flex-col gap-3">
        {items.map((it) => (
          <li key={it.id} className="flex gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
            <a href={it.url} target="_blank" rel="noopener noreferrer" className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
              {it.image ? (
                <img src={it.image} alt={it.name} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-2xl">🛍️</div>
              )}
            </a>
            <div className="flex min-w-0 flex-1 flex-col">
              <a href={it.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-sm font-semibold leading-snug">
                {it.name}
              </a>
              <span className="truncate text-xs text-muted-foreground">{safeHost(it.url)} ↗</span>
              <div className="mt-auto flex items-center justify-between pt-2">
                <button onClick={() => setEditing(it)} className="font-mono text-base font-bold text-primary">
                  {Number(it.price) ? brl(Number(it.price)) : "Definir preço"}
                </button>
                <div className="flex items-center gap-1 rounded-full bg-muted p-0.5">
                  <button onClick={() => (it.quantity <= 1 ? remove(it) : update(it, { quantity: it.quantity - 1 }))} className="h-7 w-7 rounded-full text-lg leading-none" aria-label="Diminuir">
                    {it.quantity <= 1 ? "×" : "−"}
                  </button>
                  <span className="w-5 text-center font-mono text-sm">{it.quantity}</span>
                  <button onClick={() => update(it, { quantity: it.quantity + 1 })} className="h-7 w-7 rounded-full text-lg leading-none" aria-label="Aumentar">+</button>
                </div>
              </div>
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-muted-foreground">
            Nenhum produto ainda. Cole um link acima.
          </li>
        )}
      </ul>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</span>
          <span className="font-mono text-3xl font-bold">{brl(total)}</span>
        </div>
      </div>

      {editing && <EditSheet item={editing} onClose={() => setEditing(null)} onSave={(p) => { update(editing, p); setEditing(null); }} onDelete={() => { remove(editing); setEditing(null); }} />}

      {confirming && (
        <ConfirmSheet
          onClose={() => setConfirming(false)}
          onConfirm={deleteList}
          title={`Apagar "${listName ?? "lista"}"?`}
          body="A lista e todos os produtos são apagados para todas as pessoas que têm o link."
        />
      )}
    </main>
  );
}

function safeHost(u: string) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } }

function EditSheet({ item, onClose, onSave, onDelete }: {
  item: Item; onClose: () => void; onSave: (p: Partial<Item>) => void; onDelete: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(Number(item.price) ? String(item.price).replace(".", ",") : "");
  const [image, setImage] = useState(item.image ?? "");
  const field = "h-12 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus:ring-2 focus:ring-ring";
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-foreground/40" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          const n = parseFloat(price.replace(/\./g, "").replace(",", ".")) || 0;
          onSave({ name: name.trim() || item.name, price: n, image: image.trim() || null });
        }}
        className="mx-auto w-full max-w-md rounded-t-3xl bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <h2 className="text-xl font-bold">Editar produto</h2>
        <label className="mt-4 block text-sm text-muted-foreground">Nome</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
        <label className="mt-3 block text-sm text-muted-foreground">Preço (R$)</label>
        <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0,00" autoFocus className={`${field} font-mono`} />
        <label className="mt-3 block text-sm text-muted-foreground">Link da imagem (opcional)</label>
        <input value={image} onChange={(e) => setImage(e.target.value)} className={field} />
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onDelete} className="h-12 rounded-xl px-4 font-semibold text-destructive">Remover</button>
          <button className="h-12 flex-1 rounded-xl bg-primary font-semibold text-primary-foreground">Salvar</button>
        </div>
      </form>
    </div>
  );
}
