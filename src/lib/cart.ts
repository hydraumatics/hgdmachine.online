/** Shopify Storefront Cart API client + cart sheet rendering. Checkout always happens on Shopify. */
import { sf } from "./shopify";
import { esc, imgUrl, money } from "./utils";

const KEY = "hyd_cart_id";
const FIELDS = `id checkoutUrl totalQuantity cost{subtotalAmount{amount currencyCode}}
 lines(first:50){nodes{id quantity attributes{key value} cost{totalAmount{amount currencyCode}}
 merchandise{... on ProductVariant{id title product{title handle} image{url altText}}}}}`;

interface Money { amount: string; currencyCode: string }
interface CartLine { id: string; quantity: number; attributes: { key: string; value: string }[]; cost: { totalAmount: Money };
  merchandise: { id: string; title: string; product: { title: string; handle: string }; image: { url: string; altText: string | null } | null } }
interface Cart { id: string; checkoutUrl: string; totalQuantity: number; cost: { subtotalAmount: Money }; lines: { nodes: CartLine[] } }
export interface NewLine { merchandiseId: string; quantity: number; attributes?: { key: string; value: string }[] }
type Payload = { cart: Cart | null; userErrors: { message: string }[] };

let cart: Cart | null = null;
let inited = false;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;

async function run(query: string, variables: Record<string, unknown>, key: string): Promise<Payload> {
  const r = (await sf<Record<string, Payload>>(query, variables))[key];
  if (r.userErrors?.length) throw new Error(r.userErrors[0].message);
  return r;
}

async function loadCart(): Promise<void> {
  const id = localStorage.getItem(KEY);
  if (id) {
    try { cart = (await sf<{ cart: Cart | null }>(`query($id:ID!){cart(id:$id){${FIELDS}}}`, { id })).cart; } catch { cart = null; }
    if (!cart) localStorage.removeItem(KEY);
  }
  render();
}

function announce(message: string): void {
  const el = $("cart-status");
  if (!el) return;
  el.textContent = "";
  setTimeout(() => (el.textContent = message), 50);
}

export function openCart(): void {
  if (document.querySelector("#cart-sheet dialog[open]")) return;
  const opener = document.querySelector<HTMLElement>("[data-open-cart]");
  opener?.focus(); // a script click does not move focus; without this, closing the cart would not return focus to the Cart button
  opener?.click();
}

export async function addToCart(lines: NewLine[]): Promise<void> {
  const id = localStorage.getItem(KEY);
  let r: Payload | null = null;
  if (id) {
    try { r = await run(`mutation($id:ID!,$lines:[CartLineInput!]!){cartLinesAdd(cartId:$id,lines:$lines){cart{${FIELDS}} userErrors{message}}}`, { id, lines }, "cartLinesAdd"); } catch { r = null; }
  }
  if (!r?.cart) r = await run(`mutation($lines:[CartLineInput!]){cartCreate(input:{lines:$lines}){cart{${FIELDS}} userErrors{message}}}`, { lines }, "cartCreate");
  cart = r.cart;
  if (!cart) throw new Error("Cart unavailable");
  localStorage.setItem(KEY, cart.id);
  render();
  announce(`Added to cart. Your cart now has ${cart.totalQuantity} item${cart.totalQuantity === 1 ? "" : "s"}.`);
  openCart();
}

async function change(lineId: string, qty: number): Promise<void> {
  const id = localStorage.getItem(KEY);
  if (!id) return;
  const r = qty < 1
    ? await run(`mutation($id:ID!,$l:[ID!]!){cartLinesRemove(cartId:$id,lineIds:$l){cart{${FIELDS}} userErrors{message}}}`, { id, l: [lineId] }, "cartLinesRemove")
    : await run(`mutation($id:ID!,$l:[CartLineUpdateInput!]!){cartLinesUpdate(cartId:$id,lines:$l){cart{${FIELDS}} userErrors{message}}}`, { id, l: [{ id: lineId, quantity: qty }] }, "cartLinesUpdate");
  cart = r.cart;
  render();
}

const stepBtn = "inline-flex size-11 items-center justify-center rounded-md border border-border text-lg hover:bg-muted focus-visible:ring-2";

function renderLine(l: CartLine): string {
  const m = l.merchandise, title = esc(m.product.title), cov = l.attributes.find((a) => a.key === "Covers");
  const img = m.image ? `<img src="${esc(imgUrl(m.image.url, 120))}" alt="" class="size-16 rounded object-cover" width="64" height="64">` : `<div class="size-16 rounded bg-muted"></div>`;
  return `<li class="flex gap-3 border-b border-border py-3">${img}
    <div class="min-w-0 flex-1"><a href="/products/${esc(m.product.handle)}" class="font-semibold leading-tight hover:underline">${title}</a>
    <p class="text-muted-foreground text-sm">${m.title !== "Default Title" ? esc(m.title) : ""}${cov ? ` · Covers: ${esc(cov.value)}` : ""}</p>
    <div class="mt-2 flex items-center gap-2">
      <button type="button" class="${stepBtn}" data-act="dec" data-id="${esc(l.id)}" data-q="${l.quantity}" aria-label="Decrease quantity of ${title}">−</button>
      <span class="min-w-8 text-center" role="status" aria-label="Quantity">${l.quantity}</span>
      <button type="button" class="${stepBtn}" data-act="inc" data-id="${esc(l.id)}" data-q="${l.quantity}" aria-label="Increase quantity of ${title}">+</button>
      <button type="button" class="text-primary-accent min-h-11 px-2 text-sm underline" data-act="rm" data-id="${esc(l.id)}" aria-label="Remove ${title} from cart">Remove</button>
    </div></div>
    <p class="font-semibold">${money(l.cost.totalAmount.amount, l.cost.totalAmount.currencyCode)}</p></li>`;
}

function render(): void {
  const n = cart?.totalQuantity ?? 0;
  document.querySelectorAll<HTMLElement>("[data-cart-count]").forEach((e) => { e.textContent = String(n); e.hidden = !n; });
  document.querySelectorAll<HTMLElement>("[data-open-cart]").forEach((b) => b.setAttribute("aria-label", n ? `Open cart, ${n} item${n === 1 ? "" : "s"}` : "Open cart"));
  const box = $("cart-lines");
  if (!box) return;
  box.innerHTML = n && cart ? cart.lines.nodes.map(renderLine).join("") : `<li class="text-muted-foreground py-10 text-center">Your cart is empty.</li>`;
  const sub = $("cart-subtotal"); if (sub) sub.textContent = n && cart ? money(cart.cost.subtotalAmount.amount, cart.cost.subtotalAmount.currencyCode) : "–";
  const co = $<HTMLAnchorElement>("cart-checkout");
  if (co) { co.href = n && cart ? cart.checkoutUrl : "#"; co.setAttribute("aria-disabled", n ? "false" : "true"); co.tabIndex = n ? 0 : -1; co.classList.toggle("pointer-events-none", !n); co.classList.toggle("opacity-50", !n); }
}

export function initCart(): void {
  const box = $("cart-lines");
  if (box && !box.dataset.bound) {
    box.dataset.bound = "1";
    box.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-act]");
      if (!b) return;
      const q = Number(b.dataset.q), act = b.dataset.act;
      change(b.dataset.id as string, act === "rm" ? 0 : act === "inc" ? q + 1 : q - 1).catch(() => announce("Could not update your cart. Please try again."));
    });
  }
  const sheet = document.querySelector<HTMLDialogElement>("#cart-sheet dialog");
  if (sheet && !sheet.dataset.focusBound) {
    sheet.dataset.focusBound = "1";
    // Safety net: if focus was lost when the cart closed (e.g. Safari does not focus buttons on click), put it back on the Cart button.
    sheet.addEventListener("close", () => {
      const active = document.activeElement;
      if (!active || active === document.body) document.querySelector<HTMLElement>("[data-open-cart]")?.focus();
    });
  }
  if (!inited) { inited = true; void loadCart(); } else render(); // no refetch on page transitions
}
