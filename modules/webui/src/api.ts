import { formatMoney } from "./format";
import axios from "axios";

export interface Charge { invoice: string; amount: number; status: string }

export async function chargeInvoice(id: string): Promise<Charge> {
  const r = await axios.post(`/payments/charge/${id}`);
  return r.data as Charge;
}

export const render = (c: Charge) => `${c.invoice}: ${formatMoney(c.amount)}`;
