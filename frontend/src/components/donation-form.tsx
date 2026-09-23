import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, type Category } from "@/lib/types";
import type { NewDonationInput } from "@/lib/store";

export function DonationForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: NewDonationInput;
  submitLabel: string;
  onSubmit: (input: NewDonationInput) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<NewDonationInput>(
    initial ?? {
      nombre: "",
      descripcion: "",
      categoria: "Alimentos no perecederos" as Category,
      cantidad: 1,
      unidad: "kg",
      vigencia: "",
      observaciones: "",
    },
  );
  const [error, setError] = useState("");

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.nombre.trim() || !form.descripcion.trim() || form.cantidad <= 0) {
          setError("Completa nombre, descripción y una cantidad mayor a cero.");
          return;
        }
        setError("");
        onSubmit({ ...form, nombre: form.nombre.trim() });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="nombre">Nombre del recurso</Label>
        <Input
          id="nombre"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          placeholder="Ej. Arroz blanco en costales"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea
          id="descripcion"
          rows={3}
          value={form.descripcion}
          onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          placeholder="Detalla el contenido, empaque y condiciones del recurso"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Categoría</Label>
          <Select
            value={form.categoria}
            onValueChange={(v) => setForm({ ...form, categoria: v as Category })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="vigencia">Vigencia / caducidad</Label>
          <Input
            id="vigencia"
            type="date"
            value={form.vigencia}
            onChange={(e) => setForm({ ...form, vigencia: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cantidad">Cantidad</Label>
          <Input
            id="cantidad"
            type="number"
            min={1}
            value={form.cantidad}
            onChange={(e) => setForm({ ...form, cantidad: Number(e.target.value) })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="unidad">Unidad</Label>
          <Input
            id="unidad"
            value={form.unidad}
            onChange={(e) => setForm({ ...form, unidad: e.target.value })}
            placeholder="kg, piezas, cajas…"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="observaciones">Observaciones de entrega</Label>
        <Textarea
          id="observaciones"
          rows={2}
          value={form.observaciones}
          onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
          placeholder="Horarios de recolección, requisitos de transporte, contacto…"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit">{submitLabel}</Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
