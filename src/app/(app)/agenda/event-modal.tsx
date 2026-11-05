"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, RotateCcw, Trash2 } from "lucide-react";
import { Alert, Button, Field, Input, Modal, SegmentedControl, Select, Switch, Textarea } from "@/components/ui";
import { dayOf, timeOf } from "@/lib/dates";
import { deleteEvent, saveEvent, setEventDone } from "@/features/agenda/actions";
import { eventSchema, type EventFormValues } from "@/features/agenda/schemas";
import type { AgendaEvent } from "./agenda-app";

export function EventModal({
  event,
  defaultDay,
  people,
  clients,
  userId,
  canEdit,
  onClose,
}: {
  event: AgendaEvent | null;
  defaultDay: string;
  people: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  userId: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: event
      ? {
          title: event.title,
          day: dayOf(event.starts_at),
          end_day: dayOf(event.ends_at),
          start_time: event.all_day ? "" : timeOf(event.starts_at),
          end_time: event.all_day ? "" : timeOf(event.ends_at),
          all_day: event.all_day,
          client_id: event.client_id ?? "",
          visibility: event.visibility,
          location: event.location ?? "",
          description: event.description,
          attendees: event.attendees,
        }
      : {
          title: "",
          day: defaultDay,
          end_day: defaultDay,
          start_time: "09:00",
          end_time: "10:00",
          all_day: false,
          client_id: "",
          visibility: "agencia",
          location: "",
          description: "",
          attendees: [],
        },
  });
  const allDay = watch("all_day");
  const visibility = watch("visibility");
  const attendees = watch("attendees") ?? [];
  const day = watch("day");

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Não foi possível salvar.");
      onClose();
      router.refresh();
    });

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={event ? (canEdit ? "Editar" : "Ver") : "Nova"}
      accent="atividade"
      size="lg"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {event && canEdit && (
            <>
              <Button variant="secondary" size="sm" disabled={pending} onClick={() => act(() => setEventDone(event.id, !event.done_at))}>
                {event.done_at ? <RotateCcw /> : <CheckCircle2 />}
                {event.done_at ? "Reabrir" : "Concluir"}
              </Button>
              {confirmDelete ? (
                <Button variant="danger" size="sm" loading={pending} onClick={() => act(() => deleteEvent(event.id))}>
                  Confirmar exclusão
                </Button>
              ) : (
                <Button variant="danger-outline" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Excluir
                </Button>
              )}
            </>
          )}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            {canEdit ? "Cancelar" : "Fechar"}
          </Button>
          {canEdit && (
            <Button type="submit" form="form-atividade" loading={pending}>
              Salvar
            </Button>
          )}
        </div>
      }
    >
      <form
        id="form-atividade"
        onSubmit={handleSubmit((v) => act(() => saveEvent(event?.id ?? null, v)))}
        className="flex flex-col gap-4"
        noValidate
      >
        {error && <Alert>{error}</Alert>}
        {event && event.owner_id !== userId && <p className="text-xs text-muted">Criada por {event.ownerName}.</p>}
        <fieldset disabled={!canEdit} className="flex flex-col gap-4">
          <Field label="Título" htmlFor="ev-title" required error={errors.title?.message}>
            <Input id="ev-title" autoFocus={!event} {...register("title")} />
          </Field>
          <div className="flex items-center gap-3">
            <Switch id="ev-allday" checked={!!allDay} onCheckedChange={(v) => setValue("all_day", v)} />
            <label htmlFor="ev-allday" className="text-sm">
              Dia inteiro
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Data" htmlFor="ev-day" error={errors.day?.message}>
              <Input
                id="ev-day"
                type="date"
                {...register("day", {
                  onChange: (e) => {
                    if (watch("end_day") < e.target.value) setValue("end_day", e.target.value);
                  },
                })}
              />
            </Field>
            {!allDay && (
              <Field label="Início" htmlFor="ev-start" error={errors.start_time?.message}>
                <Input id="ev-start" type="time" {...register("start_time")} />
              </Field>
            )}
            <Field label="Até o dia" htmlFor="ev-endday" error={errors.end_day?.message}>
              <Input id="ev-endday" type="date" min={day} {...register("end_day")} />
            </Field>
            {!allDay && (
              <Field label="Fim" htmlFor="ev-end" error={errors.end_time?.message}>
                <Input id="ev-end" type="time" {...register("end_time")} />
              </Field>
            )}
          </div>
          <p className="-mt-2 text-[11px] text-muted">Horário de Brasília.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente" htmlFor="ev-client">
              <Select id="ev-client" {...register("client_id")}>
                <option value="">Sem cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Local ou link da reunião" htmlFor="ev-loc">
              <Input id="ev-loc" {...register("location")} />
            </Field>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Quem vê</span>
            <SegmentedControl
              label="Quem vê"
              value={visibility}
              onChange={(v) => setValue("visibility", v)}
              options={[
                { value: "agencia", label: "Toda a agência" },
                { value: "privado", label: "Só eu e participantes" },
              ]}
              className="max-w-md"
            />
          </div>
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-muted">Participantes</legend>
            <div className="grid max-h-36 gap-1 overflow-y-auto sm:grid-cols-2">
              {people
                .filter((p) => p.id !== (event?.owner_id ?? userId))
                .map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-xs hover:bg-surface-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--brand)]"
                      checked={attendees.includes(p.id)}
                      onChange={(e) => setValue("attendees", e.target.checked ? [...attendees, p.id] : attendees.filter((x) => x !== p.id))}
                    />
                    {p.name}
                  </label>
                ))}
            </div>
          </fieldset>
          <Field label="Descrição" htmlFor="ev-desc">
            <Textarea id="ev-desc" rows={3} maxLength={5000} {...register("description")} />
          </Field>
        </fieldset>
      </form>
    </Modal>
  );
}
