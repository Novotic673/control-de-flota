"use client";

import { Star, Trash2 } from "lucide-react";
import { ActionButton, ActionForm, SubmitButton } from "@/components/client/forms";
import { PhotoInput } from "@/components/client/photo-input";
import { addVehiclePhotosAction, removePhotoAction, setMainPhotoAction } from "@/app/actions/vehicles";
import { FileImage, Empty } from "@/components/ui";

export function PhotoManager({ vehicleId, photos, canManage }: { vehicleId: string; photos: { id: string; fileId: string; isMain: boolean }[]; canManage: boolean }) {
  return (
    <div className="space-y-4">
      {photos.length === 0 ? <Empty title="Sin fotografías" /> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <div key={p.id} className="card overflow-hidden">
              <a href={`/api/files/${p.fileId}`} target="_blank"><FileImage fileId={p.fileId} alt="Foto vehículo" className="aspect-[4/3] w-full" /></a>
              {canManage && (
                <div className="flex items-center justify-between p-2">
                  {p.isMain ? <span className="text-xs font-semibold text-brand">Principal</span> : (
                    <ActionButton run={() => setMainPhotoAction(p.id)} className="btn-ghost min-h-0 px-2 py-1 text-xs"><Star className="h-3.5 w-3.5" /> Principal</ActionButton>
                  )}
                  <ActionButton run={() => removePhotoAction(p.id)} confirm="¿Eliminar fotografía?" className="btn-ghost min-h-0 px-2 py-1 text-xs text-danger"><Trash2 className="h-3.5 w-3.5" /></ActionButton>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {canManage && (
        <ActionForm action={addVehiclePhotosAction} resetOnSuccess className="card space-y-3 p-4">
          <input type="hidden" name="vehicleId" value={vehicleId} />
          <PhotoInput name="photos" label="Agregar fotografías" multiple capture={false} />
          <SubmitButton>Subir</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
