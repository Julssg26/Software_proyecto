import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiEntity, EntityInput } from "@/services/auth";

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export function EntityProfileCard({
  entity,
  entityName,
  accountEmail,
  canEdit,
  onSave,
}: {
  entity: ApiEntity | null;
  entityName: string;
  accountEmail: string;
  canEdit: boolean;
  onSave: (input: EntityInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<{
    name: string;
    description: string;
    city: string;
    email: string;
    phone: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const startEditing = () => {
    if (!entity) return;
    setDraft({
      name: entity.name,
      description: entity.description ?? "",
      city: entity.address?.city ?? "",
      email: entity.email ?? "",
      phone: entity.phone ?? "",
    });
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || !entity || !canEdit || inFlight.current) return;
    const name = draft.name.trim();
    const description = draft.description.trim();
    const city = draft.city.trim();
    const email = draft.email.trim();
    const phone = draft.phone.trim();
    if (!name || !description || !city || (!email && !phone)) {
      toast.error("Completa nombre, actividad, ciudad y al menos un medio de contacto.");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Ingresa un correo de contacto válido.");
      return;
    }
    inFlight.current = true;
    setSaving(true);
    try {
      await onSave({ name, description, address: { city }, email, phone });
      setDraft(null);
      toast.success("Perfil actualizado correctamente");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el perfil");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-base">Entidad</CardTitle>
        {canEdit && entity && !draft && (
          <Button type="button" variant="outline" size="sm" onClick={startEditing}>
            Editar perfil
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {draft && canEdit && entity ? (
          <form onSubmit={save} aria-label="Editar entidad" aria-busy={saving}>
            <fieldset disabled={saving} className="space-y-4">
              {(
                [
                  ["name", "Nombre de la entidad", "text", true],
                  ["description", "Actividad", "text", true],
                  ["city", "Ciudad", "text", true],
                  ["email", "Correo de contacto", "email", false],
                  ["phone", "Teléfono de contacto", "tel", false],
                ] as const
              ).map(([field, label, type, required]) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={"entity-" + field}>{label}</Label>
                  <Input
                    id={"entity-" + field}
                    name={field}
                    type={type}
                    required={required}
                    value={draft[field]}
                    onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                  />
                </div>
              ))}
              <p className="text-sm text-muted-foreground">
                Indica al menos un correo o teléfono de contacto.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">{saving ? "Guardando…" : "Guardar cambios"}</Button>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Cancelar
                </Button>
              </div>
            </fieldset>
          </form>
        ) : (
          <>
            <Row label="Nombre" value={entity?.name ?? entityName} />
            <Row label="Actividad" value={entity?.description || "Por definir"} />
            <Row label="Ciudad" value={entity?.address?.city || "Por definir"} />
            <Row
              label="Contacto"
              value={[entity?.email, entity?.phone].filter(Boolean).join(" · ") || accountEmail}
            />
            {!entity && (
              <p className="py-3 text-sm text-muted-foreground">
                No hay una entidad disponible para editar.
              </p>
            )}
          </>
        )}
        <Row
          label="Estado"
          value={
            entity ? (
              <StatusBadge status={entity.status === "active" ? "Activo" : "Inactivo"} />
            ) : (
              "Sin registro"
            )
          }
        />
        <Row label="Miembro desde" value={entity?.createdAt?.slice(0, 10) ?? "—"} />
      </CardContent>
    </Card>
  );
}
