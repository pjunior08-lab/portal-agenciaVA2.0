"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Input, Modal, Switch } from "@/components/ui";
import { saveAvailability } from "@/features/agenda/actions";
import { WEEKDAYS } from "@/features/agenda/schemas";

type Rule = { user_id: string; weekday: number; start_time: string; end_time: string };

/** Horário de trabalho semanal: cada pessoa edita o seu e vê o da equipe. */
export function AvailabilityModal({
  rules,
  people,
  userId,
  onClose,
}: {
  rules: Rule[];
  people: { id: string; name: string }[];
  userId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const mine = rules.filter((r) => r.user_id === userId);
  const [days, setDays] = useState(() =>
    WEEKDAYS.map((_, w) => {
      const r = mine.find((x) => x.weekday === w);
      return { on: !!r, start: r?.start_time.slice(0, 5) ?? "09:00", end: r?.end_time.slice(0, 5) ?? "18:00" };
    }),
  );
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const others = people.filter((p) => p.id !== userId);

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Disponibilidade"
      size="lg"
      footer={
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await saveAvailability(
                days.flatMap((d, w) => (d.on ? [{ weekday: w, start_time: d.start, end_time: d.end }] : [])),
              );
              if (!r.ok) return setError(r.error);
              onClose();
              router.refresh();
            })
          }
        >
          Salvar meu horário
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        {error && <Alert>{error}</Alert>}
        <section aria-label="Meu horário">
          <h3 className="mb-2 text-sm font-semibold">Meu horário de trabalho</h3>
          <ul className="flex flex-col gap-1.5">
            {WEEKDAYS.map((name, w) => (
              <li key={name} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
                <Switch
                  checked={days[w].on}
                  onCheckedChange={(v) => setDays((d) => d.map((x, i) => (i === w ? { ...x, on: v } : x)))}
                  aria-label={`Trabalho na ${name}`}
                />
                <span className="w-20 text-sm">{name}</span>
                {days[w].on ? (
                  <span className="flex items-center gap-1.5 text-xs">
                    <Input
                      type="time"
                      aria-label={`Início na ${name}`}
                      value={days[w].start}
                      onChange={(e) => setDays((d) => d.map((x, i) => (i === w ? { ...x, start: e.target.value } : x)))}
                      className="h-8 w-28"
                    />
                    até
                    <Input
                      type="time"
                      aria-label={`Fim na ${name}`}
                      value={days[w].end}
                      onChange={(e) => setDays((d) => d.map((x, i) => (i === w ? { ...x, end: e.target.value } : x)))}
                      className="h-8 w-28"
                    />
                  </span>
                ) : (
                  <span className="text-xs text-muted-2">Indisponível</span>
                )}
              </li>
            ))}
          </ul>
        </section>
        {others.length > 0 && (
          <section aria-label="Equipe">
            <h3 className="mb-2 text-sm font-semibold">Equipe</h3>
            <ul className="flex flex-col divide-y divide-line text-xs">
              {others.map((p) => {
                const r = rules.filter((x) => x.user_id === p.id);
                return (
                  <li key={p.id} className="flex flex-wrap gap-x-3 gap-y-1 py-2">
                    <span className="w-36 font-medium">{p.name}</span>
                    <span className="text-muted">
                      {r.length
                        ? r.map((x) => `${WEEKDAYS[x.weekday].slice(0, 3)} ${x.start_time.slice(0, 5)}–${x.end_time.slice(0, 5)}`).join(" · ")
                        : "Não informado"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  );
}
