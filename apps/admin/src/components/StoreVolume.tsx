import type { StoreUnit } from "../types";
import { StateBlock } from "./StateBlock";

type StoreVolumeProps = {
  stores: StoreUnit[];
  title?: string;
  loading?: boolean;
  error?: string | null;
};

export function StoreVolume({ stores, title = "Volume por loja", loading = false, error }: StoreVolumeProps) {
  return (
    <section className="storePanel" id="lojas">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Unidades</span>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="storeList">
        {loading ? (
          <StateBlock tone="loading" title="Carregando lojas" description="Buscando unidades e horarios." />
        ) : error ? (
          <StateBlock tone="error" title="Nao foi possivel carregar lojas" description={error} />
        ) : stores.length === 0 ? (
          <StateBlock title="Nenhuma loja cadastrada" description="Cadastre uma unidade para liberar entregas e relatorios." />
        ) : (
          stores.map((store) => (
          <div className="storeRow" key={store.name}>
            <div className="storeDot" style={{ background: store.color }} />
            <div>
              <strong>{store.name}</strong>
              <span>{store.code}</span>
              <small className="storeAddress">{store.address}</small>
              <small className="storeAddress">{formatStoreHours(store)}</small>
            </div>
            <b>{store.queue}</b>
          </div>
          ))
        )}
      </div>
    </section>
  );
}

function formatStoreHours(store: StoreUnit) {
  const openDays = store.weeklyHours?.filter((hours) => !hours.closed) ?? [];
  if (openDays.length === 0) return "Horario nao cadastrado";

  const first = openDays[0];
  const sameHours = openDays.every((hours) => hours.opensAt === first.opensAt && hours.closesAt === first.closesAt);

  if (openDays.length === 7 && sameHours) {
    return `Segunda a domingo, ${first.opensAt} as ${first.closesAt}`;
  }

  return "Horario com variacao semanal";
}
