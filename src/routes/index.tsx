import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSaved, remember, type SavedList } from "@/lib/lists";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Carrinho — suas listas de compra" },
      { name: "description", content: "Crie listas de compra com links, fotos e preços somados automaticamente." },
      { property: "og:title", content: "Carrinho — suas listas de compra" },
      { property: "og:description", content: "Crie listas de compra com links, fotos e preços somados automaticamente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const nav = useNavigate();
  const [saved, setSaved] = useState<SavedList[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setSaved(getSaved()), []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase
      .from("lists").insert({ name: name.trim() || "Minha lista" }).select().single();
    setBusy(false);
    if (error || !data) return alert("Não foi possível criar a lista");
    remember({ id: data.id, name: data.name });
    nav({ to: "/l/$id", params: { id: data.id } });
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-16 pt-12">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Carrinho</p>
      <h1 className="mt-2 text-5xl font-extrabold leading-[0.95] tracking-tight">
        Cole o link.<br />A gente soma.
      </h1>
      <p className="mt-4 text-muted-foreground">
        Junte produtos de qualquer loja numa lista só e compartilhe com quem quiser.
      </p>

      <form onSubmit={create} className="mt-8 flex flex-col gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da lista (ex: Casa nova)"
          className="h-14 rounded-2xl border border-input bg-card px-4 text-base outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          disabled={busy}
          className="h-14 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground shadow-card transition active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "Criando..." : "Criar nova lista"}
        </button>
      </form>

      {saved.length > 0 && (
        <section className="mt-12">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Suas listas</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {saved.map((l) => (
              <li key={l.id}>
                <Link
                  to="/l/$id"
                  params={{ id: l.id }}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-4 shadow-card"
                >
                  <span className="font-semibold">{l.name}</span>
                  <span className="text-primary">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
