import { useState } from "react";
import { uid } from "../lib/format";
import { useStore } from "../lib/store";
import type { Account, AccountDesk } from "../lib/types";
import { Field, Modal } from "./Ui";

const KINDS = [
  { id: "futures", label: "Prop firm · Futures" },
  { id: "cfd", label: "Prop firm · CFDs" },
  { id: "forex", label: "Prop firm · Forex" },
  { id: "broker", label: "Broker account" },
] as const;

export function AddAccountModal({ onClose, preset }: { onClose: () => void; preset?: "prop" | "broker" }) {
  const store = useStore();
  const [name, setName] = useState("");
  const [firm, setFirm] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>(preset === "broker" ? "broker" : "futures");
  const [balance, setBalance] = useState(kind === "broker" ? 10000 : 50000);
  const [target, setTarget] = useState(3000);
  const [daily, setDaily] = useState(1000);
  const [maxLoss, setMaxLoss] = useState(2000);
  const [trailing, setTrailing] = useState(true);
  const [minDays, setMinDays] = useState(1);
  const [consistency, setConsistency] = useState(50);
  const prop = kind !== "broker";

  const save = () => {
    if (!name.trim()) {
      store.toast("Give the account a name");
      return;
    }
    const desk: AccountDesk = prop ? kind : "stocks";
    const account: Account = {
      id: uid("acc"),
      name: name.trim(),
      broker: firm.trim() || name.trim(),
      firm: firm.trim() || undefined,
      kind: prop ? "prop" : "live",
      desk,
      balance0: Number(balance) || 0,
      rules: prop
        ? {
            profitTarget: Number(target) || 0,
            dailyLoss: Number(daily) || 0,
            maxLoss: Number(maxLoss) || 0,
            trailing,
            minDays: Number(minDays) || 0,
            consistency: Number(consistency) > 0 ? Number(consistency) / 100 : undefined,
            note: `${KINDS.find((k) => k.id === kind)?.label}. Confirm these rules with the firm before you size off them.`,
          }
        : undefined,
    };
    store.addAccount(account);
    onClose();
  };

  return (
    <Modal title="Add an account" onClose={onClose}>
      <div className="stack">
        <Field label="Type">
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </Field>
        <div className="grid-3" style={{ gap: 10 }}>
          <Field label="Account name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="FTMO 50K · 2" /></Field>
          <Field label={prop ? "Firm" : "Broker"}><input value={firm} onChange={(e) => setFirm(e.target.value)} placeholder={prop ? "FTMO" : "Interactive Brokers"} /></Field>
          <Field label="Starting balance ($)"><input type="number" value={balance} onChange={(e) => setBalance(Number(e.target.value))} /></Field>
        </div>
        {prop && (
          <div className="grid-3" style={{ gap: 10 }}>
            <Field label="Profit target ($)"><input type="number" value={target} onChange={(e) => setTarget(Number(e.target.value))} /></Field>
            <Field label="Daily loss ($)"><input type="number" value={daily} onChange={(e) => setDaily(Number(e.target.value))} /></Field>
            <Field label="Max loss ($)"><input type="number" value={maxLoss} onChange={(e) => setMaxLoss(Number(e.target.value))} /></Field>
            <Field label="Min trading days"><input type="number" value={minDays} onChange={(e) => setMinDays(Number(e.target.value))} /></Field>
            <Field label="Consistency cap (%)"><input type="number" value={consistency} onChange={(e) => setConsistency(Number(e.target.value))} /></Field>
            <label className="row" style={{ alignSelf: "end", paddingBottom: 8 }}>
              <input type="checkbox" checked={trailing} onChange={(e) => setTrailing(e.target.checked)} />
              Trailing max loss
            </label>
          </div>
        )}
        <button className="btn btn-primary" onClick={save}>Save account</button>
        <p className="faint">You can add as many as you want. Prop Futures, CFDs, Forex, and broker accounts all stay in this browser.</p>
      </div>
    </Modal>
  );
}

export function deskLabel(account: Account) {
  if (account.kind === "live") return "Broker";
  if (account.desk === "cfd") return "CFDs";
  if (account.desk === "forex") return "Forex";
  if (account.desk === "futures") return "Futures";
  return account.desk || "Prop";
}
